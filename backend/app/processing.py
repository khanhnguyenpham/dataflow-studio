"""Bounded import and profiling; source values are never silently corrected."""

import csv
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from io import BytesIO, StringIO
from pathlib import Path
import statistics
import unicodedata
import zipfile
from defusedxml.common import DefusedXmlException
from xml.etree.ElementTree import ParseError

from openpyxl import load_workbook

from .errors import Problem


def value_text(value):
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def parse_file(content, filename, settings, sheet=None, encoding="utf-8-sig"):
    if not content:
        raise Problem("empty_file")
    if len(content) > settings.max_bytes:
        raise Problem("file_too_large", 413)
    ext = Path(filename).suffix.casefold()
    sheets = []
    if ext == ".csv":
        if encoding not in {"utf-8-sig", "utf-8", "cp1258", "cp1252"}:
            raise Problem("encoding")
        if b"\x00" in content or content.startswith(b"PK\x03\x04"):
            raise Problem("invalid_file")
        try:
            text = content.decode(encoding, errors="strict")
        except UnicodeDecodeError:
            raise Problem("encoding") from None
        try:
            dialect = csv.Sniffer().sniff(text[:8192], delimiters=",;\t|")
        except csv.Error:
            dialect = csv.excel
        rows = csv.reader(StringIO(text, newline=""), dialect, strict=True)
        try:
            columns = next(rows)
            records = bounded_rows(rows, columns, settings)
        except (StopIteration, csv.Error):
            raise Problem("invalid_file") from None
    elif ext == ".xlsx":
        try:
            with zipfile.ZipFile(BytesIO(content)) as archive:
                entries = archive.infolist()
                if (
                    len(entries) > 1000
                    or sum(f.file_size for f in entries) > 30 * 1024 * 1024
                    or any(f.file_size > max(1, f.compress_size) * 300 for f in entries)
                    or any(
                        "vbaproject" in f.filename.casefold() or "externallinks/" in f.filename.casefold()
                        for f in entries
                    )
                ):
                    raise Problem("unsafe_workbook")
            book = load_workbook(BytesIO(content), read_only=True, data_only=False, keep_links=False)
            try:
                sheets = book.sheetnames
                if len(sheets) > 20:
                    raise Problem("workbook_limit")
                if sheet is None and len(sheets) > 1:
                    return {"sheets": sheets, "requires_sheet": True}
                selected = sheet or sheets[0]
                if selected not in sheets:
                    raise Problem("sheet_missing")
                ws = book[selected]
                if ws.max_column > settings.max_columns or ws.max_row > settings.max_rows + 1:
                    raise Problem("dataset_limit")
                rows = ws.iter_rows(values_only=True)
                columns = [value_text(x) for x in next(rows)]
                records = bounded_rows(rows, columns, settings)
                sheet = selected
            finally:
                book.close()
        except (zipfile.BadZipFile, KeyError, ValueError, StopIteration, OSError, ParseError, DefusedXmlException):
            raise Problem("invalid_file") from None
    else:
        raise Problem("unsupported_file")
    if not columns or len(columns) > settings.max_columns:
        raise Problem("dataset_limit")
    if any(not isinstance(c, str) or not c.strip() or len(c) > 255 for c in columns):
        raise Problem("invalid_headers")
    normalized = [unicodedata.normalize("NFC", c.strip()) for c in columns]
    if len(normalized) != len(set(normalized)):
        raise Problem("duplicate_headers")
    if not records:
        raise Problem("empty_dataset")
    return {"columns": columns, "records": records, "sheet": sheet, "sheets": sheets}


def bounded_rows(rows, columns, settings):
    result = []
    for row in rows:
        if len(row) != len(columns):
            raise Problem("ragged_rows")
        if len(result) >= settings.max_rows:
            raise Problem("dataset_limit")
        result.append([value_text(x) for x in row])
    return result


def number(value):
    try:
        n = Decimal(value.strip())
        return n if n.is_finite() and abs(n.adjusted()) <= 18 and len(n.as_tuple().digits) <= 30 else None
    except (InvalidOperation, AttributeError):
        return None


def valid_date(value):
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except ValueError:
            continue
    return None


def profile(columns, records):
    duplicates = len(records) - len({tuple(r) for r in records})
    summaries = []
    for i, column in enumerate(columns):
        values = [r[i] for r in records]
        present = [v for v in values if v is not None and v.strip() != ""]
        missing = len(values) - len(present)
        normalized = "".join(
            c for c in unicodedata.normalize("NFKD", column.casefold()) if not unicodedata.combining(c)
        )
        numeric = [number(v) for v in present]
        dates = [valid_date(v) for v in present]
        id_like = any(t in normalized for t in ("id", "code", "sku", "ma ", "mã")) or any(
            v.startswith("0") and len(v) > 1 and v.isdigit() for v in present
        )
        date_hint = any(t in normalized for t in ("date", "ngay", "ngày"))
        number_hint = any(t in normalized for t in ("amount", "quantity", "price", "revenue", "total", "gia", "lượng"))
        kind = (
            "date"
            if date_hint
            else "number"
            if not id_like and (number_hint or present and all(n is not None for n in numeric))
            else "text"
        )
        invalid = (
            sum(x is None for x in dates if kind == "date")
            if kind == "date"
            else sum(x is None for x in numeric)
            if kind == "number"
            else 0
        )
        valid = [n for n in numeric if n is not None] if kind == "number" else []
        stats = (
            {
                "min": str(min(valid)),
                "max": str(max(valid)),
                "mean": str(sum(valid) / len(valid)),
                "median": str(statistics.median(valid)),
            }
            if valid
            else None
        )
        outliers = 0
        if len(valid) >= 4:
            q1, _, q3 = statistics.quantiles(valid, n=4, method="inclusive")
            span = q3 - q1
            outliers = sum(n < q1 - Decimal("1.5") * span or n > q3 + Decimal("1.5") * span for n in valid)
        summaries.append(
            {
                "name": column,
                "suggested_type": kind,
                "missing": missing,
                "unique": len(set(present)),
                "invalid": invalid,
                "outlier_warnings": outliers,
                "statistics": stats,
            }
        )
    return {
        "rows": len(records),
        "columns": len(columns),
        "duplicate_rows": duplicates,
        "missing_cells": sum(c["missing"] for c in summaries),
        "invalid_candidates": sum(c["invalid"] for c in summaries),
        "fields": summaries,
        "type_inference": "heuristic-review-required",
        "outliers_are_errors": False,
    }

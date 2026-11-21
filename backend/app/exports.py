import csv
from io import StringIO


def escaped(value):
    if value is not None and (value.startswith(("\t", "\r", "\n")) or value.lstrip().startswith(("=", "+", "-", "@"))):
        return "'" + value
    return value or ""


def csv_bytes(columns, records):
    buffer = StringIO(newline="")
    writer = csv.writer(buffer)
    count = 0
    for row in [columns] + records:
        writer.writerow([escaped(value) for value in row])
        count += sum(escaped(value) != (value or "") for value in row)
    return buffer.getvalue().encode("utf-8-sig"), count

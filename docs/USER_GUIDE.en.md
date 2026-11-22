# Using DataFlow Studio

[Tiếng Việt](USER_GUIDE.vi.md)

## Start and import

Choose **Try a private workspace** to use an isolated, two-hour guest workspace.
The October sample loads automatically. It is synthetic and deliberately contains
defects. Guest workspaces hold three datasets; download work you need before the
session expires. Permanent accounts are created by an administrator.

**Overview** opens first. It lists your recent datasets, version-pinned reports
and workflow activity. Open a recent dataset to inspect it, or select **Import data**.
An empty count means no matching items in your workspace; failed reads show an
error with retry. Home does not claim that your data is clean.

Use **Import data** for CSV or XLSX. Initial limits are 5 MiB, 10,000 rows and 100
columns. Select the correct CSV encoding, or choose a worksheet if Excel contains
several. A wrong encoding is rejected rather than silently repaired. Files cannot
execute macros or external links. Names, identifiers and original values stay text.

**My datasets** shows a paginated table. On phones, expand a row to see its fields.
Changing language changes labels and displayed numbers, not your data.

## Inspect before editing

**Data quality** shows missing cells, exact duplicate rows, suggested types,
numeric statistics and the five most frequent non-empty values per column.
Suggestions and invalid-value candidates are heuristics. They are not a verified
business schema. Values outside the displayed 1.5-IQR interval are review warnings;
zero, negative or unusually large values are not automatically errors.

The October sample has six rows, one duplicate, a missing quantity, a textual
quantity and an impossible date. Its IDs must keep their leading zeros.

## Clean, check and confirm

Open **Clean & export**, select an operation and columns, and **Add step**.
Steps run in the listed order. Dates require explicit accepted formats; selecting
both day-first and month-first formats rejects ambiguous dates. Number conversion
requires explicit decimal/thousands separators.

Your recipe steps stay when you change pages or datasets in this signed-in tab.
Return and preview again before applying; previews and confirmations are not
retained. A different version starts without the old draft. Refreshing the page,
signing out or an ended session clears these temporary steps. Save a workflow
when you need to keep them for another visit. An ended/revoked session returns
you to sign-in; a wrong current password alone does not close the workspace.

**Check a rule** validates required values, uniqueness, normalized numbers or
dates without changing values. A failure stops the recipe and identifies the
column and the first affected row numbers. Those numbers refer to the input of
that step, including its header; previous filters/deduplication can change them.
Empty values fail by default. “Ignore empty values” does not override a required rule.

Select **Preview changes**. Compare the first ten rows and the row/cell impact of
each step. Only **Confirm and save version** creates a derived version. The source
is never overwritten. A stale/expired preview must be recalculated.

History can restore an earlier version. This moves the current pointer; later
versions remain available. Recheck the current version before exporting.
CSV protects formula-like values with an apostrophe; XLSX stores text as text.
JSON preserves exact stored strings. A quality download includes source checksum,
quality findings and processing history.

## Reuse a monthly report

1. Start with the **October sales** dataset already loaded in a fresh guest.
   Load **Product lookup** and **November sales** from the sample menu, once each.
   Together these use the guest's three slots; do not load October a second time.
2. Select October; add **Remove duplicates** using **Order ID**. Expand
   **Save a reusable workflow**, name it and choose a left join to Product lookup
   using **Product Code** on both sides.
   After saving, **Open saved workflow** opens that definition with its source
   and lookup already selected. Nothing executes until you choose to run it.
3. Open **Workflows**, select that saved definition and the matching source/lookup.
   Run and inspect the preview. October becomes five rows with product labels.
   Its date/quantity defects still require a real business decision.
4. Select November as source and run the same saved definition. The result has
   three rows. Review and confirm to save a derived version.

Lookup keys must be unique and non-empty. Unmatched keys stop a strict join.
Allow them only deliberately: left join retains them with empty lookup cells;
inner join drops them and reports the count. The “Sales with an unmatched product”
sample lets you test this failure.

Changed columns stop execution. **Review column names** suggests mappings based
on names and bilingual rules. Review every pair, preview headers/rows, and explicitly
approve removing extra columns when necessary. Apply alignment as a derived version,
then run the saved workflow again. Similarity scores are not confidence probabilities.

Workflow drafts can add, reorder, disable or remove steps. Save a new definition
version before running. Pending/interrupted runs have **Check / continue this run**;
this reuses the same execution, not a second submission. A run still executing is
not cancellable. After two minutes, an interrupted execution can become failed;
start a deliberate new run after correcting its inputs.

## Analyze and export

Choose November's reviewed, deduplicated version in **Analytics**.
Group by **Product Code**, calculate **Sum** of **Quantity**, confirm the version,
and calculate. The fixture's total is **12**, across three products.

Bar supports signed categories. Line requires ordered numeric or ISO-date groups.
Pie requires at most eight non-negative count/sum groups and a positive total.
The chart displays up to twenty non-empty groups; the table/export includes all
groups, up to 1,000. Numeric blanks are excluded and counted; malformed numbers fail.
Charts round display labels; server calculations and JSON use Decimal text.

Save a named report to pin its version and configuration, or save its aggregation
as a workflow for another compatible month. Later cleaning/restoring does not alter
a pinned report. Delete a report without deleting its source. Deleting a source
dataset also deletes its dependent reports and run history.

For errors, follow [Troubleshooting](TROUBLESHOOTING.md). Do not upload confidential
information to a public portfolio instance.

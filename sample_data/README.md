# Synthetic fixtures

All rows are made for this project; they are not customer orders.

`monthly-sales.csv` has six rows, one duplicated row, one missing quantity, an invalid date (31 February), one non-numeric quantity and a deliberately large quantity. The large value is a review warning, not a confirmed error. IDs include leading zeros and must remain text. No transformation should silently repair the invalid date or infer the missing quantity.

`products.csv` is a unique product-code lookup for the four products in October. `next-month-sales.csv` has four rows, three unique order IDs and valid quantities/dates. These files can be loaded from the sample menu without uploading local files. The workflow browser test deduplicates October to five rows and joins product labels, then repeats that saved definition on November to produce three rows. This example does not claim October's remaining date/quantity defects were repaired by a join.

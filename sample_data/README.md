# Synthetic fixtures

All rows are made for this project; they are not customer orders.

`monthly-sales.csv` has six rows, one duplicated row, one missing quantity, an invalid date (31 February), one non-numeric quantity and a deliberately large quantity. The large value is a review warning, not a confirmed error. IDs include leading zeros and must remain text. No transformation should silently repair the invalid date or infer the missing quantity.

Further monthly/schema and inventory fixtures will be added with the cleaning and workflow slices.

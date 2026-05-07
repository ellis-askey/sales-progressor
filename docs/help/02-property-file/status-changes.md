# Changing File Status

Every file has a status that reflects where it stands in the overall sales process. The status is shown as a badge at the top of the property file and in the All Files list.

## Available statuses

| Status | Meaning |
|---|---|
| **Active** | The sale is in progression. This is the default state from file creation. |
| **Exchanged** | Contracts have been exchanged. Both VM19 and PM26 should be marked complete. |
| **Completed** | The sale has completed (keys handed over, funds transferred). Both VM20 and PM27 should be marked complete. |
| **Withdrawn** | The file has been withdrawn — the sale fell through or was put on hold. |
| **Fallen through** | The sale collapsed entirely (different from a temporary withdrawal). |

## How to change status

Open the property file. On the Overview tab, click the status badge. A dropdown appears with the available next states. Select the new status and confirm.

Alternatively, marking VM20 (sale completed — seller) or PM27 (purchase completed — buyer) complete will prompt you to update the file status automatically.

## Effect on the Hub

- **Exchanged** and **Completed** files drop off the Active Files count on the Hub.
- **Withdrawn** and **Fallen through** files also leave the active pipeline.
- All non-active files are still visible in the All Files view with the appropriate status filter.

## Reopening a file

If a sale falls through and then resurrects (e.g. the buyer is replaced), you can change the status back to Active. All milestones, notes, and history are preserved.

## Related articles

- [Overview tab](overview-tab.md)
- [All Files](../01-running-your-pipeline/all-files.md)
- [Vendor milestones — VM1 to VM20](../03-milestones/vendor-milestones.md)

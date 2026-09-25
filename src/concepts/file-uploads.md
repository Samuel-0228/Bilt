Status: GUIDED

# File Uploads

## What It Is
Securely accepting, validating, and storing files uploaded by users.

## Why AI-Generated Applications Often Miss It
File uploads are complex. AIs often write code that saves files directly to the local disk without checking the file type or size, leading to path traversal vulnerabilities.

## Real-World Consequence
Attackers can upload malicious executables, overwrite system files using path traversal (`../../../etc/passwd`), or fill up the server's disk space causing a denial of service.

## What Bilt Can Verify
Bilt verifies this through guided procedures, generating a route map and requesting evidence for each specific route.

## What Bilt Cannot Verify
Bilt cannot perform deep antivirus scanning on files dynamically at runtime.

## How an Agent Should Inspect It
The agent should check if file extensions and MIME types are validated, file sizes are restricted, and files are stored securely (e.g., S3 buckets) rather than locally.

## What a Secure Implementation Should Look Like
Uploads are buffered or streamed directly to isolated cloud storage, strictly validated by content signature (not just extension), and have enforced size limits.

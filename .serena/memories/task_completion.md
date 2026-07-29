# Task completion

- Frontend/backend changes: run `npm --prefix Code run lint` and `npm --prefix Code run build`.
- Supabase schema/function changes: validate migration/function syntax and deploy only to an appropriate configured project; never place service-role keys, Azure keys, or Power Automate webhook secrets in frontend files.
- Documentation changes: run `python3 docs/generate_pdf.py` and `file docs/AI_Financial_Automation_Project_Understanding.pdf`.
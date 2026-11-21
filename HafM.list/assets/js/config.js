/* HafM.list — site configuration (edit before publishing).

   ALLOWED_EMAIL_DOMAINS
     Only work e-mails on these domains can sign in. Leave the array empty to allow any e-mail.

   ADMIN_EMAIL_HASHES
     Admins can create / edit / archive lists and grant the "editor" role to other e-mails.
     E-mails are stored here as SHA-256 hashes (not plain text) because this file is public.
     To add an admin: open the site → حسابي / Account → "نسخ رمز الصلاحية" (copy permission hash),
     or run:  printf 'hafm-admin|name@halfm.sa' | sha256sum   (e-mail in lower case)
     and paste the 64-character result below.
     If the array is empty, the first account created on a device becomes its admin.

   WEEK_START_DAY  6 = Saturday (week runs Saturday → Friday, Asia/Riyadh). */
window.HAFM_CONFIG = {
  ALLOWED_EMAIL_DOMAINS: ['halfm.sa'],
  ADMIN_EMAIL_HASHES: [
    '66500de8f602aa7295e3331bbe06db6e9e0ff34bb28759bebe8b91eb04e103c5'
  ],
  TIME_ZONE: 'Asia/Riyadh',
  WEEK_START_DAY: 6,
  EXCELJS_URL: 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'
};

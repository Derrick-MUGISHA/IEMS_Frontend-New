const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]!);

export function emailUnsubscribeAddress(): string {
  const url = process.env.ORG_URL || "https://igirerwanda.org";
  return process.env.ORG_UNSUBSCRIBE_EMAIL || `unsubscribe@${new URL(url).hostname}`;
}

export function renderEmailFooter(): string {
  const org = process.env.ORG_NAME || "Igire Rwanda";
  const url = (process.env.ORG_URL || "https://igirerwanda.org").replace(/\/+$/, "");
  const address = process.env.ORG_ADDRESS || "Kigali, Rwanda";
  const logo = process.env.ORG_LOGO_URL || "https://res.cloudinary.com/dvl1iht4u/image/upload/v1767626818/img_dsjutp.png";
  const link = (href: string, text: string) => `<a href="${escape(href)}" style="color:#6b7280;text-decoration:none">${text}</a>`;

  return `
  <div data-email-footer style="margin-top:40px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:#8a8f98;text-align:center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse">
      <tr><td align="center" style="padding:0 0 4px">
        <img src="${escape(logo)}" alt="Igire Rwanda Logo" height="80" style="display:block;margin:0 auto;height:80px;width:auto;border:0;outline:none;text-decoration:none" />
      </td></tr>
      <tr><td align="center" style="padding:8px 12px 20px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#065F46">
        Official Communication from ${escape(org)} Organization
      </td></tr>
    </table>
    <div style="padding:20px 12px 0;border-top:1px solid #eceef0">
      <p style="margin:0 0 8px">${link(process.env.ORG_PRIVACY_URL || `${url}/privacy`, "Privacy Policy")}&nbsp;&nbsp;·&nbsp;&nbsp;${link(process.env.ORG_CONTACT_URL || `${url}/contact`, "Contact us")}&nbsp;&nbsp;·&nbsp;&nbsp;${link(process.env.ORG_BLOG_URL || `${url}/blog`, "Read our blog")}</p>
      <p style="margin:0 0 6px;color:#b0b4bb">© ${new Date().getFullYear()} ${escape(org)}. All rights reserved. We are located at ${escape(address)}.</p>
      <p style="margin:0">You're receiving this because you're on the ${escape(org)} contact list. ${link(`mailto:${emailUnsubscribeAddress()}?subject=Unsubscribe`, "Unsubscribe")}.</p>
    </div>
  </div>`;
}

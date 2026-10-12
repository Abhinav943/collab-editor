import config from "../config.js";
import { logger } from "./logger.js";

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const oneLine = (value = "", max = 200) =>
  String(value)
    .replace(/[\r\n]+/g, " ")
    .slice(0, max);

export async function sendInviteEmail({
  to,
  projectName,
  inviterName,
  role,
  acceptUrl,
}) {
  // No key configured? Log the link so the flow is still testable.
  if (!config.resendApiKey) {
    logger.warn(
      "RESEND_API_KEY not set — invite email skipped. Link:",
      acceptUrl,
    );
    return { skipped: true, acceptUrl };
  }

  const html = `
    <p><strong>${escapeHtml(inviterName)}</strong> invited you to collaborate on <strong>${escapeHtml(projectName)}</strong> as <strong>${escapeHtml(role)}</strong>.</p>
    <p><a href="${escapeHtml(acceptUrl)}">Accept the invitation</a></p>
    <p>This link expires in 7 days.</p>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.resendApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: config.resendFrom,
      to,
      subject: oneLine(`${inviterName} invited you to "${projectName}"`),
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend failed (${res.status}): ${body}`);
  }
  return res.json();
}

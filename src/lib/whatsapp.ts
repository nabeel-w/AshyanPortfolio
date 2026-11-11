/** Build a wa.me deep link: digits only, optional prefilled message. Safe on server and client. */
export function whatsappHref(phone: string, message?: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

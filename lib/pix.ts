const field = (id: string, value: string) => id + String(value.length).padStart(2, "0") + value;

function clean(value: string, max: number) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9 .-]/g, "")
      .toUpperCase()
      .trim()
      .slice(0, max) || "NA"
  );
}

function crc16(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    crc &= 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildPixPayload(input: {
  key: string;
  receiver: string;
  city: string;
  amountCents: number;
  txid: string;
}) {
  const key = input.key.trim();
  if (!key) return "";
  const merchant = field("00", "BR.GOV.BCB.PIX") + field("01", key);
  const amount = (input.amountCents / 100).toFixed(2);
  const txid = clean(input.txid.replace(/[^A-Za-z0-9]/g, ""), 25);
  const additional = field("05", txid);
  const base =
    field("00", "01") +
    field("26", merchant) +
    field("52", "0000") +
    field("53", "986") +
    field("54", amount) +
    field("58", "BR") +
    field("59", clean(input.receiver, 25)) +
    field("60", clean(input.city, 15)) +
    field("62", additional) +
    "6304";
  return base + crc16(base);
}

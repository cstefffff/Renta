import { afterEach, describe, expect, it, vi } from "vitest";
import {
  calculateVatBreakdown,
  generateEFacturaXmlPreview,
} from "@/lib/invoicing/provider";
import { checkRateLimit } from "@/lib/security/rate-limit";
import type { InvoiceRecord } from "@/lib/types/database";

/**
 * ============================================================================
 * RentA (Faza 16 / M16.1) — Suite de Teste Unitare: Facturare SRL / RO e-Factura
 * & Securitate Rate Limiting (`tests/unit/invoicing-and-security.test.ts`)
 * ============================================================================
 */

describe("Facturare SRL & TVA — calculateVatBreakdown (lib/invoicing/provider.ts)", () => {
  it("calculează corect baza impozabilă și TVA 19% pentru 119 RON brut", () => {
    const breakdown = calculateVatBreakdown(119, 19);

    expect(breakdown.subtotal_ron).toBe(100);
    expect(breakdown.vat_rate).toBe(19);
    expect(breakdown.vat_amount_ron).toBe(19);
    expect(breakdown.total_ron).toBe(119);
    expect(
      Number((breakdown.subtotal_ron + breakdown.vat_amount_ron).toFixed(2))
    ).toBe(breakdown.total_ron);
  });

  it("păstrează identitatea contabilă subtotal + TVA === total și la sume cu rotunjire", () => {
    const amounts = [10, 24.99, 37.5, 100, 333.33, 1250.75];
    for (const gross of amounts) {
      const b = calculateVatBreakdown(gross, 19);
      expect(Number((b.subtotal_ron + b.vat_amount_ron).toFixed(2))).toBe(
        b.total_ron
      );
      expect(b.subtotal_ron).toBeGreaterThan(0);
      expect(b.vat_amount_ron).toBeGreaterThan(0);
    }
  });

  it("gestionează corect TVA 0% (neplătitor) și valori invalide/negative", () => {
    const zeroVat = calculateVatBreakdown(250, 0);
    expect(zeroVat.subtotal_ron).toBe(250);
    expect(zeroVat.vat_amount_ron).toBe(0);
    expect(zeroVat.total_ron).toBe(250);

    const negative = calculateVatBreakdown(-100, 19);
    expect(negative.subtotal_ron).toBe(0);
    expect(negative.vat_amount_ron).toBe(0);
    expect(negative.total_ron).toBe(0);
  });
});

describe("Generator XML UBL 2.1 RO e-Factura — generateEFacturaXmlPreview", () => {
  const sampleInvoice: InvoiceRecord = {
    id: "inv-001",
    invoice_number: "RNT-2026-0042",
    booking_id: "550e8400-e29b-41d4-a716-446655440000",
    payment_id: "pay-001",
    owner_id: "owner-001",
    renter_id: "renter-001",
    issuer_name: "RENTA MARKETPLACE SRL",
    issuer_cui: "RO12345678",
    client_name: 'SC <script>alert("xss")</script> & Co\' SRL',
    client_cui: "RO87654321",
    client_address: 'Str. Exemplu <1> & "2", București',
    subtotal_ron: 100,
    vat_rate: 19,
    vat_amount_ron: 19,
    total_ron: 119,
    currency: "RON",
    provider: "internal",
    external_invoice_id: null,
    efactura_status: "pending_anaf",
    issued_at: "2026-11-21T10:00:00.000Z",
    created_at: "2026-11-21T10:00:00.000Z",
  };

  it("generează XML UBL 2.1 conform CIUS-RO 1.0.1 și escapează strict caracterele <script>&\"'", () => {
    const xml = generateEFacturaXmlPreview(sampleInvoice);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain(
      "urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1"
    );
    expect(xml).toContain("<cbc:ID>RNT-2026-0042</cbc:ID>");
    expect(xml).toContain("<cbc:IssueDate>2026-11-21</cbc:IssueDate>");
    expect(xml).toContain(
      '<cbc:PayableAmount currencyID="RON">119.00</cbc:PayableAmount>'
    );

    // Prevenire XML Injection / XSS: caracterele brute NU au voie să apară în XML
    expect(xml).not.toContain("<script>");
    expect(xml).not.toContain("</script>");
    expect(xml).toContain(
      "<cbc:RegistrationName>SC &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; Co&apos; SRL</cbc:RegistrationName>"
    );
    expect(xml).toContain(
      "<cbc:StreetName>Str. Exemplu &lt;1&gt; &amp; &quot;2&quot;, București</cbc:StreetName>"
    );
  });

  it("folosește categoria de taxă Z când TVA-ul este 0%", () => {
    const xmlZeroVat = generateEFacturaXmlPreview({
      ...sampleInvoice,
      vat_rate: 0,
      vat_amount_ron: 0,
      subtotal_ron: 100,
      total_ron: 100,
    });

    expect(xmlZeroVat).toContain("<cbc:ID>Z</cbc:ID>");
    expect(xmlZeroVat).toContain("<cbc:Percent>0.00</cbc:Percent>");
  });
});

describe("Securitate — Rate Limiter (lib/security/rate-limit.ts)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("permite cererile sub limită și blochează cererea care depășește limita cu retryAfterSeconds > 0", () => {
    const key = `test:limit:${Date.now()}:${Math.random()}`;
    const limit = 3;
    const windowMs = 60_000;

    const r1 = checkRateLimit(key, limit, windowMs);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);
    expect(r1.retryAfterSeconds).toBe(0);

    const r2 = checkRateLimit(key, limit, windowMs);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = checkRateLimit(key, limit, windowMs);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);

    // A 4-a cerere trebuie blocată
    const r4 = checkRateLimit(key, limit, windowMs);
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
    expect(r4.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("izolează contoarele între chei diferite și deblochează după expirarea ferestrei de timp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-21T12:00:00.000Z"));

    const keyA = "test:window:user-a";
    const keyB = "test:window:user-b";
    const windowMs = 10_000;

    expect(checkRateLimit(keyA, 1, windowMs).allowed).toBe(true);
    expect(checkRateLimit(keyA, 1, windowMs).allowed).toBe(false);

    // Utilizatorul B nu este afectat de limita atinsă de utilizatorul A
    expect(checkRateLimit(keyB, 1, windowMs).allowed).toBe(true);

    // Avansăm timpul peste fereastra de 10 secunde -> cheia A trebuie să fie din nou permisă
    vi.advanceTimersByTime(10_500);
    const afterWindow = checkRateLimit(keyA, 1, windowMs);
    expect(afterWindow.allowed).toBe(true);
    expect(afterWindow.remaining).toBe(0);
  });
});

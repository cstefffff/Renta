/**
 * ============================================================================
 * RentA (Faza 14 / M14.2) — Provider de Facturare SRL & Generator RO e-Factura
 * (`lib/invoicing/provider.ts`)
 * ============================================================================
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Acest modul joacă rolul unui `InvoiceProvider` / `EFacturaXmlSerializer`
 *   pur (fără stare globală și fără side-effects pe baza de date).
 * - Citește configurația fiscală a firmei (SRL-ul operator al platformei RentA)
 *   din variabilele de mediu (`.env.local`), cu fallback-uri sigure pentru
 *   mediul de dezvoltare/staging.
 * - Calculează defalcarea TVA (bază impozabilă + TVA = total brut) folosind
 *   rotunjire deterministă la 2 zecimale (echivalentul `BigDecimal.setScale(2, HALF_UP)`
 *   din Java, dar pe valori mici în RON).
 * - Generează un preview XML UBL 2.1 compatibil cu standardul ANAF RO e-Factura
 *   (CIUS-RO 1.0.1), cu escape strict al caracterelor speciale XML.
 */

import type { InvoiceProvider, InvoiceRecord } from "@/lib/types/database";

export interface IssuerConfig {
  name: string;
  cui: string;
  vatRate: number;
  provider: InvoiceProvider;
  oblioConfigured: boolean;
}

export interface VatBreakdown {
  subtotal_ron: number;
  vat_rate: number;
  vat_amount_ron: number;
  total_ron: number;
}

/**
 * Rotunjește o sumă financiară la exact 2 zecimale.
 */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Returnează configurația fiscală a emitentului (SRL-ul RentA) din variabilele
 * de mediu, cu valori implicite sigure dacă `.env.local` nu le definește încă.
 */
export function getIssuerConfig(): IssuerConfig {
  const name =
    process.env.RENTA_ISSUER_NAME?.trim() || "RENTA MARKETPLACE SRL";
  const cui = process.env.RENTA_ISSUER_CUI?.trim() || "RO00000000";

  const rawVat = process.env.RENTA_VAT_RATE?.trim();
  const parsedVat = rawVat !== undefined && rawVat !== "" ? Number(rawVat) : 19;
  const vatRate =
    Number.isFinite(parsedVat) && parsedVat >= 0 && parsedVat <= 100
      ? round2(parsedVat)
      : 19;

  const oblioConfigured = Boolean(
    process.env.OBLIO_EMAIL?.trim() && process.env.OBLIO_API_SECRET?.trim()
  );

  return {
    name,
    cui,
    vatRate,
    provider: oblioConfigured ? "oblio" : "internal",
    oblioConfigured,
  };
}

/**
 * Calculează defalcarea TVA dintr-un total brut (TVA inclus) în RON.
 *
 * Exemplu (pentru TVA 19% și comision brut 119.00 RON):
 *   - subtotal_ron = 100.00 RON
 *   - vat_amount_ron = 19.00 RON
 *   - total_ron = 119.00 RON
 * Garantăm identitatea contabilă: `subtotal_ron + vat_amount_ron === total_ron`.
 */
export function calculateVatBreakdown(
  grossTotalRon: number,
  vatRate: number = 19
): VatBreakdown {
  const safeGross =
    Number.isFinite(grossTotalRon) && grossTotalRon > 0
      ? round2(grossTotalRon)
      : 0;
  const safeRate =
    Number.isFinite(vatRate) && vatRate >= 0 && vatRate <= 100
      ? round2(vatRate)
      : 19;

  if (safeGross === 0 || safeRate === 0) {
    return {
      subtotal_ron: safeGross,
      vat_rate: safeRate,
      vat_amount_ron: 0,
      total_ron: safeGross,
    };
  }

  const subtotal = round2(safeGross / (1 + safeRate / 100));
  const vatAmount = round2(safeGross - subtotal);

  return {
    subtotal_ron: subtotal,
    vat_rate: safeRate,
    vat_amount_ron: vatAmount,
    total_ron: safeGross,
  };
}

/**
 * Escapează caracterele speciale XML pentru a preveni XML Injection / sintaxă invalidă.
 */
function escapeXml(value: string | null | undefined): string {
  const str = value ?? "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Extrage data calendaristică `YYYY-MM-DD` dintr-un timestamp ISO.
 */
function formatIsoDateOnly(isoString: string): string {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

/**
 * Formatează un număr cu exact 2 zecimale pentru câmpurile monetare UBL 2.1.
 */
function formatMoney(amount: number): string {
  return (Number.isFinite(amount) ? amount : 0).toFixed(2);
}

/**
 * Generează reprezentarea XML UBL 2.1 conformă cu specificația ANAF RO e-Factura
 * (CIUS-RO 1.0.1) pentru o factură de comision RentA.
 *
 * Această ieșire poate fi inspectată în panoul de facturi, descărcată ca `.xml`
 * sau transmisă ulterior către SPV ANAF / Oblio / SmartBill.
 */
export function generateEFacturaXmlPreview(invoice: InvoiceRecord): string {
  const issueDate = formatIsoDateOnly(invoice.issued_at);
  const currency = escapeXml(invoice.currency || "RON");
  const invoiceNumber = escapeXml(invoice.invoice_number);
  const issuerName = escapeXml(invoice.issuer_name);
  const issuerCui = escapeXml(invoice.issuer_cui);
  const clientName = escapeXml(invoice.client_name);
  const clientCui = escapeXml(invoice.client_cui || "0000000000000");
  const clientAddress = escapeXml(invoice.client_address || "România");
  const subtotal = formatMoney(invoice.subtotal_ron);
  const vatRate = formatMoney(invoice.vat_rate);
  const vatAmount = formatMoney(invoice.vat_amount_ron);
  const total = formatMoney(invoice.total_ron);
  const taxCategoryId = invoice.vat_rate > 0 ? "S" : "Z";

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"`,
    `         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"`,
    `         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">`,
    `  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1</cbc:CustomizationID>`,
    `  <cbc:ID>${invoiceNumber}</cbc:ID>`,
    `  <cbc:IssueDate>${issueDate}</cbc:IssueDate>`,
    `  <cbc:DueDate>${issueDate}</cbc:DueDate>`,
    `  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>`,
    `  <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>`,
    `  <cac:AccountingSupplierParty>`,
    `    <cac:Party>`,
    `      <cac:PostalAddress>`,
    `        <cbc:StreetName>Sediu Social Operator Marketplace</cbc:StreetName>`,
    `        <cbc:CityName>București</cbc:CityName>`,
    `        <cac:Country>`,
    `          <cbc:IdentificationCode>RO</cbc:IdentificationCode>`,
    `        </cac:Country>`,
    `      </cac:PostalAddress>`,
    `      <cac:PartyTaxScheme>`,
    `        <cbc:CompanyID>${issuerCui}</cbc:CompanyID>`,
    `        <cac:TaxScheme>`,
    `          <cbc:ID>VAT</cbc:ID>`,
    `        </cac:TaxScheme>`,
    `      </cac:PartyTaxScheme>`,
    `      <cac:PartyLegalEntity>`,
    `        <cbc:RegistrationName>${issuerName}</cbc:RegistrationName>`,
    `      </cac:PartyLegalEntity>`,
    `    </cac:Party>`,
    `  </cac:AccountingSupplierParty>`,
    `  <cac:AccountingCustomerParty>`,
    `    <cac:Party>`,
    `      <cac:PostalAddress>`,
    `        <cbc:StreetName>${clientAddress}</cbc:StreetName>`,
    `        <cac:Country>`,
    `          <cbc:IdentificationCode>RO</cbc:IdentificationCode>`,
    `        </cac:Country>`,
    `      </cac:PostalAddress>`,
    `      <cac:PartyTaxScheme>`,
    `        <cbc:CompanyID>${clientCui}</cbc:CompanyID>`,
    `        <cac:TaxScheme>`,
    `          <cbc:ID>VAT</cbc:ID>`,
    `        </cac:TaxScheme>`,
    `      </cac:PartyTaxScheme>`,
    `      <cac:PartyLegalEntity>`,
    `        <cbc:RegistrationName>${clientName}</cbc:RegistrationName>`,
    `      </cac:PartyLegalEntity>`,
    `    </cac:Party>`,
    `  </cac:AccountingCustomerParty>`,
    `  <cac:TaxTotal>`,
    `    <cbc:TaxAmount currencyID="${currency}">${vatAmount}</cbc:TaxAmount>`,
    `    <cac:TaxSubtotal>`,
    `      <cbc:TaxableAmount currencyID="${currency}">${subtotal}</cbc:TaxableAmount>`,
    `      <cbc:TaxAmount currencyID="${currency}">${vatAmount}</cbc:TaxAmount>`,
    `      <cac:TaxCategory>`,
    `        <cbc:ID>${taxCategoryId}</cbc:ID>`,
    `        <cbc:Percent>${vatRate}</cbc:Percent>`,
    `        <cac:TaxScheme>`,
    `          <cbc:ID>VAT</cbc:ID>`,
    `        </cac:TaxScheme>`,
    `      </cac:TaxCategory>`,
    `    </cac:TaxSubtotal>`,
    `  </cac:TaxTotal>`,
    `  <cac:LegalMonetaryTotal>`,
    `    <cbc:LineExtensionAmount currencyID="${currency}">${subtotal}</cbc:LineExtensionAmount>`,
    `    <cbc:TaxExclusiveAmount currencyID="${currency}">${subtotal}</cbc:TaxExclusiveAmount>`,
    `    <cbc:TaxInclusiveAmount currencyID="${currency}">${total}</cbc:TaxInclusiveAmount>`,
    `    <cbc:PayableAmount currencyID="${currency}">${total}</cbc:PayableAmount>`,
    `  </cac:LegalMonetaryTotal>`,
    `  <cac:InvoiceLine>`,
    `    <cbc:ID>1</cbc:ID>`,
    `    <cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity>`,
    `    <cbc:LineExtensionAmount currencyID="${currency}">${subtotal}</cbc:LineExtensionAmount>`,
    `    <cac:Item>`,
    `      <cbc:Description>Comision intermediere platformă RentA (rezervare ${escapeXml(invoice.booking_id)})</cbc:Description>`,
    `      <cbc:Name>Servicii intermediere marketplace RentA</cbc:Name>`,
    `      <cac:ClassifiedTaxCategory>`,
    `        <cbc:ID>${taxCategoryId}</cbc:ID>`,
    `        <cbc:Percent>${vatRate}</cbc:Percent>`,
    `        <cac:TaxScheme>`,
    `          <cbc:ID>VAT</cbc:ID>`,
    `        </cac:TaxScheme>`,
    `      </cac:ClassifiedTaxCategory>`,
    `    </cac:Item>`,
    `    <cac:Price>`,
    `      <cbc:PriceAmount currencyID="${currency}">${subtotal}</cbc:PriceAmount>`,
    `    </cac:Price>`,
    `  </cac:InvoiceLine>`,
    `</Invoice>`,
  ].join("\n");
}

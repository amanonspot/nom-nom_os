import type { LocalOrder } from '@nomnom/sync-client';

/**
 * Interim browser-based printing (Phase 1). Opens a print window with an
 * ESC/POS-style narrow layout. Phase 6 replaces this with native thermal
 * printing via Tauri/Rust over USB/Bluetooth.
 */

function printHtml(title: string, bodyHtml: string): void {
  const w = window.open('', '_blank', 'width=320,height=600');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${title}</title><style>
    * { font-family: 'Courier New', monospace; }
    body { width: 280px; margin: 0 auto; padding: 8px; color: #000; }
    h1 { font-size: 15px; text-align: center; margin: 4px 0; }
    .muted { color: #444; font-size: 11px; text-align: center; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    td { padding: 2px 0; vertical-align: top; }
    .r { text-align: right; }
    .sub { color: #333; font-size: 11px; padding-left: 8px; }
    hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
    .tot td { font-weight: bold; }
  </style></head><body>${bodyHtml}</body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

export function printKOT(order: LocalOrder, tableName?: string): void {
  const rows = order.lines
    .filter((l) => order.status !== 'void')
    .map((l) => {
      const opts = [...l.optionLabels, ...l.addOnLabels].join(', ');
      const note = l.notes ? `<div class="sub">↳ ${l.notes}</div>` : '';
      return `<tr><td>${l.quantity}× ${l.nameSnapshot}${
        opts ? `<div class="sub">${opts}</div>` : ''
      }${note}</td></tr>`;
    })
    .join('');
  printHtml(
    'KOT',
    `<h1>KITCHEN ORDER</h1>
     <div class="muted">${tableName ? `Table ${tableName}` : order.orderType} · ${new Date(
       order.createdAt,
     ).toLocaleTimeString()}</div>
     <div class="muted">#${order.id.slice(0, 8)}</div><hr/>
     <table>${rows}</table><hr/>`,
  );
}

export function printReceipt(order: LocalOrder, tableName?: string): void {
  const rows = order.lines
    .map((l) => {
      const opts = [...l.optionLabels, ...l.addOnLabels].join(', ');
      return `<tr><td>${l.quantity}× ${l.nameSnapshot}${
        opts ? `<div class="sub">${opts}</div>` : ''
      }</td><td class="r">₹${(l.unitPrice * l.quantity).toFixed(2)}</td></tr>`;
    })
    .join('');
  printHtml(
    'Receipt',
    `<h1>NOM NOM DINER</h1>
     <div class="muted">${tableName ? `Table ${tableName}` : order.orderType} · ${new Date().toLocaleString()}</div>
     <div class="muted">#${order.id.slice(0, 8)}</div><hr/>
     <table>${rows}</table><hr/>
     <table>
       <tr><td>Subtotal</td><td class="r">₹${order.subtotal.toFixed(2)}</td></tr>
       <tr><td>GST</td><td class="r">₹${order.taxTotal.toFixed(2)}</td></tr>
       ${order.discountTotal ? `<tr><td>Discount</td><td class="r">-₹${order.discountTotal.toFixed(2)}</td></tr>` : ''}
       <tr class="tot"><td>TOTAL</td><td class="r">₹${order.grandTotal.toFixed(2)}</td></tr>
     </table><hr/>
     <div class="muted">Thank you! Visit again.</div>`,
  );
}

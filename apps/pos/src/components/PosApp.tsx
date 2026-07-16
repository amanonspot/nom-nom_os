'use client';

import { useCallback, useRef, useState } from 'react';
import type { MenuItem, Order, Table } from '@nomnom/types';
import type { LocalOrder, LocalOrderLine, OrderType } from '@nomnom/sync-client';
import { usePos } from '@/lib/pos';
import {
  addLine,
  newOrder,
  quickLine,
  serverOrderToLocal,
  setBillComp,
  setDiscount,
  toggleLineComp,
} from '@/lib/cart';
import { assignTable as apiAssignTable, getOrder, verifyPin } from '@/lib/api';
import { OrderScreen } from './OrderScreen';
import { TablesScreen } from './TablesScreen';
import { ItemDialog } from './ItemDialog';
import { PaymentDialog, type PaymentSplit } from './PaymentDialog';
import { PinDialog } from './PinDialog';
import { TablePicker } from './TablePicker';
import { GuestDialog } from './GuestDialog';
import { CoversDialog } from './CoversDialog';
import { CompDialog, type CompTarget } from './CompDialog';
import { DiscountDialog } from './DiscountDialog';
import { NoticeToast } from './NoticeToast';

type View = 'order' | 'tables';

export function PosApp() {
  const pos = usePos();
  const { session, menu, addOns, tables, engine, notice, setTableStatus, refreshActiveOrders } = pos;
  const branchId = session?.branchId ?? '';
  const token = session?.token ?? '';

  const [view, setView] = useState<View>('order');
  const [draft, setDraft] = useState<LocalOrder | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const dirty = useRef(false);

  const showFlash = useCallback((msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash((f) => (f === msg ? null : f)), 2500);
  }, []);

  // Dialog state
  const [dialogItem, setDialogItem] = useState<MenuItem | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showVoid, setShowVoid] = useState(false);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [showGuest, setShowGuest] = useState(false);
  const [showCovers, setShowCovers] = useState(false);
  const [comp, setComp] = useState<CompTarget | null>(null);
  const [showDiscount, setShowDiscount] = useState(false);

  const mutate = useCallback((next: LocalOrder) => {
    dirty.current = true;
    setDraft(next);
  }, []);

  // Persist the current draft (idempotent upsert) if it has content + changed.
  const autosave = useCallback(async () => {
    if (!draft || !engine) return;
    if (!dirty.current || draft.lines.length === 0) return;
    const toSave: LocalOrder = { ...draft, status: draft.status === 'paid' ? 'paid' : 'open' };
    await engine.enqueueOrder(toSave);
    dirty.current = false;
    if (toSave.tableId) setTableStatus(toSave.tableId, 'occupied');
    void refreshActiveOrders();
  }, [draft, engine, setTableStatus, refreshActiveOrders]);

  const startNewOrder = useCallback(
    (orderType: OrderType) => {
      setDraft(newOrder(branchId, null, orderType));
      dirty.current = false;
      setView('order');
    },
    [branchId],
  );

  const openTable = useCallback(
    async (table: Table) => {
      if (table.status === 'free') {
        setDraft({ ...newOrder(branchId, table.id, 'dine_in') });
        dirty.current = false;
        setTableStatus(table.id, 'occupied');
        setView('order');
        return;
      }
      // Occupied → reopen its active order for view/edit.
      const active = pos.activeOrders.find((o) => o.table === table.id);
      try {
        const full = active ? await getOrder(token, active.id!) : null;
        if (full) {
          setDraft(serverOrderToLocal(full));
          dirty.current = false;
          setView('order');
          return;
        }
      } catch {
        /* fall through to a fresh order */
      }
      setDraft(newOrder(branchId, table.id, 'dine_in'));
      dirty.current = false;
      setView('order');
    },
    [branchId, token, pos.activeOrders, setTableStatus],
  );

  const goToTables = useCallback(async () => {
    await autosave();
    setDraft(null);
    setView('tables');
    void refreshActiveOrders();
  }, [autosave, refreshActiveOrders]);

  const onNewOrderNav = useCallback(async () => {
    await autosave();
    startNewOrder('dine_in');
  }, [autosave, startNewOrder]);

  // --- Item add ---
  function onPickItem(item: MenuItem) {
    if (!draft) return;
    if ((item.variation_groups?.length ?? 0) > 0 || addOns.length > 0) {
      setDialogItem(item);
    } else {
      mutate(addLine(draft, quickLine(item)));
    }
  }

  // --- Table assign / change ---
  async function chooseTable(table: Table) {
    if (!draft) return;
    setShowTablePicker(false);
    const prevTableId = draft.tableId ?? null;
    if (draft.serverId && prevTableId && prevTableId !== table.id) {
      // Persisted order → change table server-side (frees old, occupies new).
      try {
        await apiAssignTable(token, draft.serverId, table.id);
      } catch {
        /* offline — local move still applies below */
      }
    }
    if (prevTableId && prevTableId !== table.id) setTableStatus(prevTableId, 'free');
    setTableStatus(table.id, 'occupied');
    mutate({ ...draft, tableId: table.id, orderType: 'dine_in' });
  }

  // --- Guest ---
  function setGuest(phone: string, name: string) {
    if (!draft) return;
    setShowGuest(false);
    mutate({ ...draft, customerPhone: phone, customerName: name });
  }

  // --- Covers ---
  function setCovers(n: number) {
    if (!draft) return;
    setShowCovers(false);
    mutate({ ...draft, covers: Math.max(1, n) });
  }

  // --- Comp (PIN-gated) ---
  async function applyComp(reason: string, pin: string): Promise<boolean> {
    if (!draft || !comp) return false;
    const ok = await verifyPin(token, pin).catch(() => false);
    if (!ok) return false; // wrong PIN — dialog stays open
    if (comp.scope === 'bill') {
      mutate(setBillComp(draft, !draft.isComplimentary, reason));
    } else if (comp.lineId) {
      mutate(toggleLineComp(draft, comp.lineId, reason));
    }
    setComp(null);
    return true;
  }

  // --- Custom discount (PIN-gated) ---
  async function applyDiscount(amount: number, pin: string): Promise<boolean> {
    if (!draft) return false;
    const ok = await verifyPin(token, pin).catch(() => false);
    if (!ok) return false; // wrong PIN — dialog stays open
    mutate(setDiscount(draft, amount));
    setShowDiscount(false);
    return true;
  }

  function removeDiscount() {
    if (!draft) return;
    mutate(setDiscount(draft, 0));
    setShowDiscount(false);
  }

  // --- Actions ---
  // Save: persist the running order and return to the floor (with feedback).
  async function saveOrder() {
    if (!draft || !engine || draft.lines.length === 0) return;
    const open: LocalOrder = { ...draft, status: 'open' };
    await engine.enqueueOrder(open);
    dirty.current = false;
    if (open.tableId) setTableStatus(open.tableId, 'occupied');
    showFlash('Order saved');
    setDraft(null);
    setView('tables');
    void refreshActiveOrders();
  }

  async function sendToKitchen() {
    if (!draft || !engine || draft.lines.length === 0) return;
    const open: LocalOrder = { ...draft, status: 'open' };
    await engine.enqueueOrder(open);
    dirty.current = false;
    setDraft(open);
    if (open.tableId) setTableStatus(open.tableId, 'occupied');
    showFlash('KOT sent to kitchen');
    void refreshActiveOrders();
  }

  async function pay(splits: PaymentSplit[]) {
    if (!draft || !engine) return;
    const paid: LocalOrder = { ...draft, status: 'paid', payments: splits };
    await engine.enqueueOrder(paid);
    dirty.current = false;
    setShowPayment(false);
    if (draft.tableId) setTableStatus(draft.tableId, 'free');
    // Surface cash change in the confirmation, if any.
    const cash = splits.find((s) => s.mode === 'cash' && s.tendered);
    const change = cash?.tendered ? Math.round((cash.tendered - draft.grandTotal) * 100) / 100 : 0;
    showFlash(change > 0 ? `Paid · return ₹${change.toFixed(2)}` : 'Payment received');
    setDraft(null);
    setView('tables');
    void refreshActiveOrders();
  }

  function voidOrder(_pin: string) {
    if (draft?.tableId) setTableStatus(draft.tableId, 'free');
    dirty.current = false;
    setDraft(null);
    setShowVoid(false);
    setView('tables');
  }

  const tableName = (id?: string | null) => tables.find((t) => t.id === id)?.name;

  return (
    <div className="min-h-screen bg-spoto-bg">
      {(flash || notice) && <NoticeToast text={flash ?? notice!} />}
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-spoto-line bg-spoto-surface px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="font-heading text-lg font-bold text-spoto-ink">Nom Nom POS</span>
          <button
            onClick={onNewOrderNav}
            className="ml-2 rounded-lg bg-spoto-purple px-3 py-1.5 text-sm font-heading font-semibold text-white"
          >
            New Order
          </button>
        </div>
        <nav className="flex items-center gap-1">
          {(['order', 'tables'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => (v === 'tables' ? goToTables() : setView('order'))}
              className={`rounded-lg px-3 py-1.5 text-sm font-heading font-semibold capitalize ${
                view === v ? 'bg-spoto-purple/15 text-spoto-purple-ink' : 'text-spoto-muted'
              }`}
            >
              {v}
            </button>
          ))}
          <button onClick={pos.logout} className="ml-2 text-sm text-spoto-muted underline">
            Sign out
          </button>
        </nav>
      </header>

      {view === 'tables' || !draft ? (
        <TablesScreen onOpenTable={openTable} onNewOrder={startNewOrder} />
      ) : (
        <OrderScreen
          draft={draft}
          menu={menu}
          tableName={tableName(draft.tableId)}
          onPickItem={onPickItem}
          onMutate={mutate}
          onOrderType={(t) => mutate({ ...draft, orderType: t, ...(t !== 'dine_in' ? { tableId: null } : {}) })}
          onOpenTablePicker={() => setShowTablePicker(true)}
          onOpenGuest={() => setShowGuest(true)}
          onOpenCovers={() => setShowCovers(true)}
          onComp={(target) => setComp(target)}
          onDiscount={() => setShowDiscount(true)}
          onSave={saveOrder}
          onKot={sendToKitchen}
          onPay={() => setShowPayment(true)}
          onVoid={() => setShowVoid(true)}
        />
      )}

      {/* Dialogs */}
      {dialogItem && draft && (
        <ItemDialog
          item={dialogItem}
          addOns={addOns}
          onClose={() => setDialogItem(null)}
          onAdd={(line: LocalOrderLine) => {
            mutate(addLine(draft, line));
            setDialogItem(null);
          }}
        />
      )}
      {showTablePicker && (
        <TablePicker
          tables={tables}
          currentTableId={draft?.tableId ?? null}
          onPick={chooseTable}
          onClose={() => setShowTablePicker(false)}
        />
      )}
      {showGuest && draft && (
        <GuestDialog
          token={token}
          branchId={branchId}
          initialPhone={draft.customerPhone ?? ''}
          initialName={draft.customerName ?? ''}
          onSave={setGuest}
          onClose={() => setShowGuest(false)}
        />
      )}
      {showCovers && draft && (
        <CoversDialog current={draft.covers} onSave={setCovers} onClose={() => setShowCovers(false)} />
      )}
      {showPayment && draft && (
        <PaymentDialog total={draft.grandTotal} onConfirm={pay} onClose={() => setShowPayment(false)} />
      )}
      {showVoid && (
        <PinDialog title="Void order — manager PIN" onConfirm={voidOrder} onClose={() => setShowVoid(false)} />
      )}
      {comp && (
        <CompDialog target={comp} onConfirm={applyComp} onClose={() => setComp(null)} />
      )}
      {showDiscount && draft && (
        <DiscountDialog
          base={draft.subtotal + draft.taxTotal}
          current={draft.discountTotal}
          onConfirm={applyDiscount}
          onRemove={removeDiscount}
          onClose={() => setShowDiscount(false)}
        />
      )}
    </div>
  );
}

// Re-export the Order type for children that need it.
export type { Order };

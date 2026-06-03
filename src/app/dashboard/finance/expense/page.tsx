'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2 as SpinnerGap, Plus, Trash, TrendingDown as TrendDown, Filter as Funnel, Receipt } from "lucide-react";
import { formatTaka } from '@/lib/finance-utils';
import { ExpenseEntry } from '@/types/finance';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';

export default function ExpensePage() {
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [userRole, setUserRole] = useState('');

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [form, setForm] = useState({
    category: 'other',
    amount: '',
    description: '',
    vendor: '',
    payment_method: 'cash',
    expense_date: new Date().toISOString().split('T')[0]
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      let url = '/api/finance/expense?';
      if (dateFrom) url += `from=${dateFrom}&`;
      if (dateTo) url += `to=${dateTo}&`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setExpenses(data.data);
    } catch {
      toast.error('Failed to load expense data');
    } finally {
      setLoading(false);
    }
  };

  const fetchRole = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (data) setUserRole(data.role);
    }
  };

  useEffect(() => { fetchData(); fetchRole(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.description) { toast.error('Amount and Description are required'); return; }
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: user } = await supabase.auth.getUser();
      const res = await fetch('/api/finance/expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount), paid_by: user?.user?.id })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Expense recorded');
        setOpen(false);
        setForm(prev => ({ ...prev, amount: '', description: '', vendor: '' }));
        fetchData();
      } else toast.error(data.error || 'Failed');
    } catch { toast.error('Error'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense entry?')) return;
    try {
      const supabase = createClient() as any;
      const { error } = await supabase.from('expense_entries').delete().eq('id', id);
      if (error) throw error;
      toast.success('Deleted');
      fetchData();
    } catch { toast.error('Failed to delete'); }
  };

  const totalExpense = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-heading mb-1">Expense Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Track bills, purchases, and other outflows.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold shadow-none px-6">
              <Plus size={16} strokeWidth={2} className="mr-2" /> Record Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="border-border/50 shadow-lg rounded-2xl sm:max-w-[425px]">
            <DialogHeader><DialogTitle className="text-xl font-bold text-foreground">New Expense Entry</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Category</Label>
                  <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                    <SelectTrigger className="h-11 rounded-xl bg-muted border-0 font-bold text-foreground focus:ring-1 focus:ring-ring/30 shadow-none"><SelectValue /></SelectTrigger>
                    <SelectContent className="border-border/50 rounded-xl shadow-md">
                      <SelectItem value="electricity" className="rounded-lg font-medium">Electricity</SelectItem>
                      <SelectItem value="water" className="rounded-lg font-medium">Water</SelectItem>
                      <SelectItem value="maintenance" className="rounded-lg font-medium">Maintenance</SelectItem>
                      <SelectItem value="stationery" className="rounded-lg font-medium">Stationery</SelectItem>
                      <SelectItem value="sports" className="rounded-lg font-medium">Sports</SelectItem>
                      <SelectItem value="library" className="rounded-lg font-medium">Library</SelectItem>
                      <SelectItem value="cleaning" className="rounded-lg font-medium">Cleaning</SelectItem>
                      <SelectItem value="furniture" className="rounded-lg font-medium">Furniture</SelectItem>
                      <SelectItem value="transport" className="rounded-lg font-medium">Transport</SelectItem>
                      <SelectItem value="other" className="rounded-lg font-medium">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Date</Label>
                  <Input type="date" value={form.expense_date} onChange={e => setForm({...form, expense_date: e.target.value})} className="h-11 rounded-xl bg-muted border-0 font-bold text-foreground focus-visible:ring-1 focus-visible:ring-ring/30 shadow-none" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Description *</Label>
                <Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="What was purchased?" className="h-11 rounded-xl bg-muted border-0 font-bold text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-ring/30 shadow-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Amount *</Label>
                  <Input type="number" step="1" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="h-11 rounded-xl bg-muted border-0 font-mono font-bold text-foreground focus-visible:ring-1 focus-visible:ring-ring/30 shadow-none" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Payment Method</Label>
                  <Select value={form.payment_method} onValueChange={v => setForm({...form, payment_method: v})}>
                    <SelectTrigger className="h-11 rounded-xl bg-muted border-0 font-bold text-foreground focus:ring-1 focus:ring-ring/30 shadow-none"><SelectValue /></SelectTrigger>
                    <SelectContent className="border-border/50 rounded-xl shadow-md">
                      <SelectItem value="cash" className="rounded-lg font-medium">Cash</SelectItem>
                      <SelectItem value="bank" className="rounded-lg font-medium">Bank Transfer</SelectItem>
                      <SelectItem value="mobile_banking" className="rounded-lg font-medium">Mobile Banking</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Vendor / Supplier</Label>
                <Input value={form.vendor} onChange={e => setForm({...form, vendor: e.target.value})} placeholder="Company name (optional)" className="h-11 rounded-xl bg-muted border-0 font-bold text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-ring/30 shadow-none" />
              </div>
              <Button type="submit" className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold shadow-none" disabled={submitting}>
                {submitting ? <SpinnerGap size={16} strokeWidth={2} className="mr-2 animate-spin" /> : <Receipt size={16} strokeWidth={2} className="mr-2" />}
                Save Expense
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Funnel + Total */}
      {/* Funnel + Total */}
      <Card className="bg-card rounded-2xl border border-border/50 shadow-none">
        <CardContent className="p-4 flex flex-col sm:flex-row items-end gap-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mr-2 pb-3">
            <Funnel size={14} strokeWidth={2} /> Filter
          </div>
          <div className="space-y-1 flex-1">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">From</Label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-11 rounded-xl bg-muted border-0 font-bold text-foreground focus-visible:ring-1 focus-visible:ring-ring/30 shadow-none" />
          </div>
          <div className="space-y-1 flex-1">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">To</Label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-11 rounded-xl bg-muted border-0 font-bold text-foreground focus-visible:ring-1 focus-visible:ring-ring/30 shadow-none" />
          </div>
          <Button onClick={fetchData} disabled={loading} className="h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold shadow-none px-6">Apply</Button>
          <Button variant="outline" onClick={() => { setDateFrom(''); setDateTo(''); setTimeout(fetchData, 100); }} className="h-11 rounded-xl border-border/50 bg-white hover:bg-muted/50 text-muted-foreground font-bold shadow-none px-6">Clear</Button>
          <div className="ml-auto flex items-center gap-2 bg-primary text-primary-foreground px-5 h-11 rounded-xl shadow-none mt-4 sm:mt-0">
            <TrendDown size={16} strokeWidth={2} className="text-muted-foreground/60" />
            <span className="text-sm font-black font-mono">Total: <span className="text-red-400">{formatTaka(totalExpense)}</span></span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card rounded-2xl border border-border/50 shadow-none overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30 border-border/50">
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-[120px]">Date</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Category</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Description</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Method</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">Amount</TableHead>
                {userRole === 'admin' && <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right w-16"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12"><SpinnerGap size={24} strokeWidth={1.5} className="animate-spin mx-auto text-muted-foreground/40" /></TableCell></TableRow>
              ) : expenses.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground font-bold text-sm">No expense records found.</TableCell></TableRow>
              ) : (
                expenses.map(exp => (
                  <TableRow key={exp.id} className="group border-border/50">
                    <TableCell className="text-[11px] font-bold text-muted-foreground">{new Date(exp.expense_date).toLocaleDateString('en-GB')}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-[9px] font-bold uppercase tracking-widest border-border/50 text-muted-foreground shadow-none px-1.5 py-0">{exp.category.replace('_', ' ')}</Badge>
                    </TableCell>
                    <TableCell className="text-[11px] font-bold text-foreground">
                      {exp.description}
                      {exp.vendor && <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 block mt-0.5">Vendor: {exp.vendor}</span>}
                    </TableCell>
                    <TableCell className="capitalize text-xs">
                      <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest">{exp.payment_method.replace('_', ' ')}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono font-black text-red-600">-{formatTaka(exp.amount)}</TableCell>
                    {userRole === 'admin' && (
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600 rounded-lg" onClick={() => handleDelete(exp.id)}>
                          <Trash size={14} strokeWidth={2} />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

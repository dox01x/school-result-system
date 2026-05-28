'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, TrendingDown, Filter, Receipt } from 'lucide-react';
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

  useEffect(() => { fetchData(); }, []);

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
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-red-600 to-red-400 bg-clip-text text-transparent">Expense Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Track bills, purchases, and other outflows.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" className="shadow-md"><Plus className="w-4 h-4 mr-2" /> Record Expense</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Expense Entry</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Category</Label>
                  <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="electricity">Electricity</SelectItem>
                      <SelectItem value="water">Water</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="stationery">Stationery</SelectItem>
                      <SelectItem value="sports">Sports</SelectItem>
                      <SelectItem value="library">Library</SelectItem>
                      <SelectItem value="cleaning">Cleaning</SelectItem>
                      <SelectItem value="furniture">Furniture</SelectItem>
                      <SelectItem value="transport">Transport</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Date</Label>
                  <Input type="date" value={form.expense_date} onChange={e => setForm({...form, expense_date: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Description *</Label>
                <Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="What was purchased?" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Amount *</Label>
                  <Input type="number" step="1" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Payment Method</Label>
                  <Select value={form.payment_method} onValueChange={v => setForm({...form, payment_method: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                      <SelectItem value="mobile_banking">Mobile Banking</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Vendor / Supplier</Label>
                <Input value={form.vendor} onChange={e => setForm({...form, vendor: e.target.value})} placeholder="Company name (optional)" />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Receipt className="w-4 h-4 mr-2" />}
                Save Expense
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter + Total */}
      <Card className="border-none shadow-md">
        <CardContent className="p-4 flex flex-col sm:flex-row items-end gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase mr-2">
            <Filter className="w-3.5 h-3.5" /> Filter
          </div>
          <div className="space-y-1 flex-1">
            <Label className="text-[10px] text-muted-foreground">From</Label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1 flex-1">
            <Label className="text-[10px] text-muted-foreground">To</Label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-sm" />
          </div>
          <Button size="sm" onClick={fetchData} disabled={loading} className="h-8">Apply</Button>
          <Button size="sm" variant="ghost" onClick={() => { setDateFrom(''); setDateTo(''); setTimeout(fetchData, 100); }} className="h-8">Clear</Button>
          <div className="ml-auto flex items-center gap-2 bg-red-50 border border-red-200 px-4 py-2 rounded-lg">
            <TrendingDown className="w-4 h-4 text-red-600" />
            <span className="text-sm font-bold text-red-700">Total: {formatTaka(totalExpense)}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-lg">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs w-[100px]">Date</TableHead>
                <TableHead className="text-xs">Category</TableHead>
                <TableHead className="text-xs">Description</TableHead>
                <TableHead className="text-xs">Method</TableHead>
                <TableHead className="text-xs text-right">Amount</TableHead>
                <TableHead className="text-xs text-right w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : expenses.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No expense records found.</TableCell></TableRow>
              ) : (
                expenses.map(exp => (
                  <TableRow key={exp.id} className="group">
                    <TableCell className="text-sm font-medium">{new Date(exp.expense_date).toLocaleDateString('en-GB')}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-[10px]">{exp.category.replace('_', ' ')}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {exp.description}
                      {exp.vendor && <span className="text-[10px] text-muted-foreground block">Vendor: {exp.vendor}</span>}
                    </TableCell>
                    <TableCell className="capitalize text-xs">
                      <span className="bg-muted px-2 py-1 rounded text-[10px] font-semibold">{exp.payment_method.replace('_', ' ')}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-red-600">-{formatTaka(exp.amount)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete(exp.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
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

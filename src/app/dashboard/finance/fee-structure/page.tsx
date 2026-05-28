'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { FeeStructure, FeeType } from '@/types/finance';
import { createClient } from '@/lib/supabase/client';
import { CLASS_COLUMNS } from '@/lib/supabase/select-columns';
import { Settings, Plus, Loader2, Trash2, Pencil, Check, X, CalendarDays, Calendar } from 'lucide-react';
import { formatTaka } from '@/lib/finance-utils';

const MONTHLY_TYPES = ['tuition', 'hostel', 'transport', 'boarding'];

function isMonthly(type: string) {
  return MONTHLY_TYPES.includes(type.toLowerCase().trim());
}

export default function FeeStructurePage() {
  const [fees, setFees] = useState<FeeStructure[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');

  const [form, setForm] = useState({
    class_name: '',
    fee_type: '' as FeeType | '',
    amount: '',
    description: '',
    academic_year: new Date().getFullYear().toString()
  });

  const supabase = createClient();

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: classData } = await supabase.from('classes').select(CLASS_COLUMNS).order('numeric_value');
      if (classData) setClasses(classData);
      const res = await fetch(`/api/finance/fee-structure?academic_year=${form.academic_year}`);
      const data = await res.json();
      if (data.success) setFees(data.data);
    } catch {
      toast.error('Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.class_name || !form.fee_type || !form.amount || !form.academic_year) {
      toast.error("Please fill all required fields"); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/finance/fee-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount) })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Fee structure added");
        setForm(prev => ({ ...prev, amount: '', description: '', fee_type: '' }));
        fetchData();
      } else {
        toast.error(data.error || "Failed to add");
      }
    } catch { toast.error("An error occurred"); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this fee?')) return;
    try {
      const res = await fetch(`/api/finance/fee-structure?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { toast.success("Deleted"); fetchData(); }
      else toast.error(data.error || "Failed to delete");
    } catch { toast.error("Error"); }
  };

  const handleEdit = async (id: string) => {
    if (!editAmount || isNaN(Number(editAmount))) { toast.error("Invalid amount"); return; }
    try {
      const res = await fetch('/api/finance/fee-structure', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, amount: parseFloat(editAmount) })
      });
      const data = await res.json();
      if (data.success) { toast.success("Updated"); setEditingId(null); fetchData(); }
      else toast.error(data.error || "Failed");
    } catch { toast.error("Error"); }
  };

  // Group fees by class
  const grouped = fees.reduce((acc: Record<string, FeeStructure[]>, f) => {
    if (!acc[f.class_name]) acc[f.class_name] = [];
    acc[f.class_name].push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Fee Structure</h1>
        <p className="text-muted-foreground mt-1 text-sm">Configure class-wise fee amounts for the academic year.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form */}
        <Card className="lg:col-span-4 border-none shadow-lg h-fit">
          <div className="h-1.5 bg-primary"></div>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Plus className="w-5 h-5" /> Add New Fee</CardTitle>
            <CardDescription>Define fee components for each class</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Academic Year</Label>
                <Input value={form.academic_year} onChange={e => setForm({...form, academic_year: e.target.value})} className="bg-card" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Class *</Label>
                <Select value={form.class_name} onValueChange={v => setForm({...form, class_name: v})}>
                  <SelectTrigger className="bg-card"><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {classes.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Fee Type *</Label>
                <Select value={form.fee_type} onValueChange={v => setForm({...form, fee_type: v as FeeType})}>
                  <SelectTrigger className="bg-card"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tuition">Tuition Fee (Monthly)</SelectItem>
                    <SelectItem value="admission">Admission Fee (Yearly)</SelectItem>
                    <SelectItem value="exam">Exam Fee (Yearly)</SelectItem>
                    <SelectItem value="sports">Sports Fee (Yearly)</SelectItem>
                    <SelectItem value="library">Library Fee (Yearly)</SelectItem>
                    <SelectItem value="book">Book Fee (Yearly)</SelectItem>
                    <SelectItem value="hostel">Hostel Fee (Monthly)</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Amount (TK) *</Label>
                <Input type="number" step="1" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="0" className="bg-card font-mono" />
              </div>
              {form.fee_type === 'other' && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Fee Name *</Label>
                  <Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="e.g. Field Trip" className="bg-card" />
                </div>
              )}
              <Button type="submit" className="w-full shadow-md" disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Add Fee
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Fee List */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="border-none shadow-lg">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="text-lg flex items-center gap-2"><Settings className="w-5 h-5 text-primary" /> Configured Fees ({form.academic_year})</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : Object.keys(grouped).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                  <Settings className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-semibold">No fee structures configured</p>
                  <p className="text-sm mt-1">Add fees using the form on the left</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(grouped).map(([className, items]) => (
                    <div key={className}>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-sm font-bold text-slate-700">{className}</h3>
                        <Badge variant="outline" className="text-[10px] h-5">{items.length} fees</Badge>
                      </div>
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30">
                              <TableHead className="text-xs">Fee Type</TableHead>
                              <TableHead className="text-xs">Frequency</TableHead>
                              <TableHead className="text-xs text-right">Amount</TableHead>
                              <TableHead className="text-xs text-right w-24">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.map(f => {
                              const monthly = isMonthly(f.fee_type);
                              const isEditing = editingId === f.id;
                              return (
                                <TableRow key={f.id} className="group">
                                  <TableCell className="font-medium capitalize">
                                    {f.fee_type === 'other' && f.description ? f.description : f.fee_type} Fee
                                  </TableCell>
                                  <TableCell>
                                    {monthly ? (
                                      <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50 text-[10px] gap-1">
                                        <CalendarDays className="w-3 h-3" /> Monthly
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 text-[10px] gap-1">
                                        <Calendar className="w-3 h-3" /> Yearly
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {isEditing ? (
                                      <Input
                                        type="number"
                                        value={editAmount}
                                        onChange={e => setEditAmount(e.target.value)}
                                        className="w-24 h-7 text-right ml-auto font-mono text-sm"
                                        autoFocus
                                      />
                                    ) : (
                                      <span className="font-mono font-bold text-slate-800">{formatTaka(f.amount)}</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {isEditing ? (
                                      <div className="flex gap-1 justify-end">
                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" onClick={() => handleEdit(f.id)}>
                                          <Check className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400" onClick={() => setEditingId(null)}>
                                          <X className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-500" onClick={() => { setEditingId(f.id); setEditAmount(f.amount.toString()); }}>
                                          <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => handleDelete(f.id)}>
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

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
import { Settings as Gear, Plus, Loader2 as SpinnerGap, Trash, Pencil, Check, X, Calendar as CalendarBlank, ClipboardList as ClipboardText } from "lucide-react";
import { formatTaka } from '@/lib/finance-utils';

const MONTHLY_TYPES = ['tuition', 'hostel', 'transport', 'boarding'];
const PER_EXAM_TYPES = ['mct_exam', 'semester_exam'];

function isMonthly(type: string) {
  return MONTHLY_TYPES.includes(type.toLowerCase().trim());
}

function isPerExam(type: string) {
  return PER_EXAM_TYPES.includes(type.toLowerCase().trim());
}

export default function FeeStructurePage() {
  const [fees, setFees] = useState<FeeStructure[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [userRole, setUserRole] = useState('');

  const [form, setForm] = useState({
    class_name: '',
    fee_type: '' as FeeType | '',
    amount: '',
    description: '',
    academic_year: new Date().getFullYear().toString()
  });

  const supabase = createClient() as any;

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

  const fetchRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (data) setUserRole(data.role);
    }
  };

  useEffect(() => { fetchData(); fetchRole(); }, []);

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

  const handlePencilSimple = async (id: string) => {
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
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-heading mb-1">Fee Structure</h1>
        <p className="text-muted-foreground mt-1 text-sm">Configure class-wise fee amounts for the academic year.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form */}
        <Card className="lg:col-span-4 border border-border/50 shadow-none rounded-2xl h-fit overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border/50">
            <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2"><Plus size={20} strokeWidth={2.5} /> Add New Fee</CardTitle>
            <CardDescription className="font-bold text-muted-foreground">Define fee components for each class</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Active Academic Year</Label>
                <Input value={form.academic_year} onChange={e => setForm({...form, academic_year: e.target.value})} className="h-11 rounded-xl bg-muted border-0 font-bold text-foreground focus-visible:ring-1 focus-visible:ring-ring/30 shadow-none" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Class *</Label>
                <Select value={form.class_name} onValueChange={v => setForm({...form, class_name: v})}>
                  <SelectTrigger className="h-11 rounded-xl bg-muted border-0 font-bold text-foreground focus:ring-1 focus:ring-ring/30 shadow-none"><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent className="border-border/50 rounded-xl shadow-md">
                    {classes.map(c => <SelectItem key={c.id} value={c.name} className="rounded-lg font-medium">{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Fee Type *</Label>
                <Select value={form.fee_type} onValueChange={v => setForm({...form, fee_type: v as FeeType})}>
                  <SelectTrigger className="h-11 rounded-xl bg-muted border-0 font-bold text-foreground focus:ring-1 focus:ring-ring/30 shadow-none"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent className="border-border/50 rounded-xl shadow-md">
                    <SelectItem value="tuition" className="rounded-lg font-medium">Tuition Fee (Monthly)</SelectItem>
                    <SelectItem value="admission" className="rounded-lg font-medium">Admission Fee (Yearly)</SelectItem>
                    <SelectItem value="mct_exam" className="rounded-lg font-medium">MCT Exam Fee (Per Exam)</SelectItem>
                    <SelectItem value="semester_exam" className="rounded-lg font-medium">Semester Exam Fee (Per Exam)</SelectItem>
                    <SelectItem value="sports" className="rounded-lg font-medium">Sports Fee (Yearly)</SelectItem>
                    <SelectItem value="library" className="rounded-lg font-medium">Library Fee (Yearly)</SelectItem>
                    <SelectItem value="book" className="rounded-lg font-medium">Book Fee (Yearly)</SelectItem>
                    <SelectItem value="hostel" className="rounded-lg font-medium">Hostel Fee (Monthly)</SelectItem>
                    <SelectItem value="other" className="rounded-lg font-medium">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Amount (TK) *</Label>
                <Input type="number" step="1" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="0" className="h-11 rounded-xl bg-muted border-0 font-mono font-bold text-foreground focus-visible:ring-1 focus-visible:ring-ring/30 shadow-none" />
              </div>
              {form.fee_type === 'other' && (
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Fee Name *</Label>
                  <Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="e.g. Field Trip" className="h-11 rounded-xl bg-muted border-0 font-bold text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-ring/30 shadow-none" />
                </div>
              )}
              <div className="flex flex-col gap-2 mt-4">
                <Button type="submit" className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold shadow-none" disabled={submitting || (userRole !== 'admin' && userRole !== 'super_admin')}>
                  {submitting ? <SpinnerGap size={16} strokeWidth={2} className="mr-2 animate-spin" /> : <Plus size={16} strokeWidth={2.5} className="mr-2" />}
                  Add Fee
                </Button>
                {userRole !== 'admin' && userRole !== 'super_admin' && <p className="text-[10px] font-bold text-red-500 text-center uppercase tracking-widest mt-1">Only Admin can add fees</p>}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Fee List */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="border border-border/50 shadow-none rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-border/50 bg-muted/30 pb-4">
              <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2"><Gear size={20} strokeWidth={2.5} className="text-foreground" /> Configured Fees ({form.academic_year})</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {loading ? (
                <div className="flex justify-center p-8"><SpinnerGap size={24} strokeWidth={2} className="animate-spin text-muted-foreground/40" /></div>
              ) : Object.keys(grouped).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border/50 rounded-2xl">
                  <Gear size={40} strokeWidth={1.5} className="mx-auto mb-3 text-muted-foreground/40" />
                  <p className="font-bold">No fee structures configured</p>
                  <p className="text-xs font-bold text-muted-foreground/60 mt-1">Add fees using the form on the left</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {Object.entries(grouped).map(([className, items]) => (
                    <div key={className}>
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="text-sm font-bold text-foreground">{className}</h3>
                        <Badge variant="outline" className="bg-muted text-muted-foreground border-border/50 text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-md shadow-none">{items.length} fees</Badge>
                      </div>
                      <div className="border border-border/50 rounded-xl overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30 border-border/50 hover:bg-muted/30">
                              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Fee Type</TableHead>
                              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Frequency</TableHead>
                              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">Amount</TableHead>
                              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right w-24">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.map(f => {
                              const monthly = isMonthly(f.fee_type);
                              const isEditing = editingId === f.id;
                              return (
                                <TableRow key={f.id} className="group border-border/50 hover:bg-muted/30">
                                  <TableCell className="font-bold text-foreground text-xs capitalize">
                                    {f.fee_type === 'other' && f.description ? f.description : f.fee_type.replace('_', ' ')} Fee
                                  </TableCell>
                                  <TableCell>
                                    {monthly ? (
                                      <Badge className="bg-muted text-muted-foreground rounded-md font-bold uppercase tracking-widest px-2 py-0.5 text-[9px] shadow-none gap-1 border-0">
                                        <CalendarBlank className="w-3 h-3" /> Monthly
                                      </Badge>
                                    ) : isPerExam(f.fee_type) ? (
                                      <Badge className="bg-muted text-muted-foreground rounded-md font-bold uppercase tracking-widest px-2 py-0.5 text-[9px] shadow-none gap-1 border-0">
                                        <ClipboardText className="w-3 h-3" /> Per Exam
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-muted text-muted-foreground rounded-md font-bold uppercase tracking-widest px-2 py-0.5 text-[9px] shadow-none gap-1 border-0">
                                        <CalendarBlank size={12} strokeWidth={2} /> Yearly
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {isEditing ? (
                                      <Input
                                        type="number"
                                        value={editAmount}
                                        onChange={e => setEditAmount(e.target.value)}
                                        className="w-24 h-8 rounded-lg bg-muted border border-border font-mono font-bold text-sm px-2 text-right focus:ring-1 focus:ring-ring/30 shadow-none ml-auto"
                                        autoFocus
                                      />
                                    ) : (
                                      <span className="font-mono font-black text-foreground">{formatTaka(f.amount)}</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {isEditing ? (
                                      <div className="flex gap-1 justify-end">
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-foreground hover:bg-muted rounded-lg" onClick={() => handlePencilSimple(f.id)}>
                                          <Check size={14} strokeWidth={2} />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:bg-muted rounded-lg" onClick={() => setEditingId(null)}>
                                          <X size={14} strokeWidth={2} />
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                        {(userRole === 'admin' || userRole === 'super_admin') && (
                                          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg" onClick={() => { setEditingId(f.id); setEditAmount(f.amount.toString()); }}>
                                            <Pencil className="w-4 h-4" />
                                          </Button>
                                        )}
                                        {(userRole === 'admin' || userRole === 'super_admin') && (
                                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-lg" onClick={() => handleDelete(f.id)}>
                                            <Trash size={14} strokeWidth={2} />
                                          </Button>
                                        )}
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

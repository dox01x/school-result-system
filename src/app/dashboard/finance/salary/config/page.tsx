'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { createClient } from '@/lib/supabase/client';
import { STAFF_SALARY_CONFIG_COLUMNS } from '@/lib/supabase/select-columns';
import { Loader2 as SpinnerGap, Plus, Trash, CheckCircle } from "lucide-react";

export default function SalaryConfigPage() {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userRole, setUserRole] = useState("");

  const [basicSalary, setBasicSalary] = useState("0");
  const [allowances, setAllowances] = useState<any[]>([]);
  const [deductions, setDeductions] = useState<any[]>([]);

  const supabase = createClient() as any;

  useEffect(() => {
    const fetchStaff = async () => {
      const { data } = await supabase.from('teachers').select('id, name, designation, phone').order('name');
      if (data) setStaffList(data);
    };
    const fetchRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (data) setUserRole(data.role);
      }
    };
    fetchStaff();
    fetchRole();
  }, [supabase]);

  // Load existing config
  useEffect(() => {
    if (!selectedStaffId) return;
    const loadConfig = async () => {
      setLoadingConfig(true);
      const { data } = await supabase
        .from('staff_salary_config')
        .select(STAFF_SALARY_CONFIG_COLUMNS)
        .eq('staff_id', selectedStaffId)
        .eq('is_active', true)
        .maybeSingle();

      if (data) {
        setBasicSalary(data.basic_salary.toString());
        setAllowances(data.allowances ? Object.entries(data.allowances).map(([k,v]) => ({name: k, amount: v})) : []);
        setDeductions(data.deductions ? Object.entries(data.deductions).map(([k,v]) => ({name: k, amount: v})) : []);
      } else {
        setBasicSalary("0");
        setAllowances([]);
        setDeductions([]);
      }
      setLoadingConfig(false);
    };
    loadConfig();
  }, [selectedStaffId, supabase]);

  const addComponent = (type: 'allowance' | 'deduction') => {
    if (type === 'allowance') setAllowances([...allowances, { name: '', amount: '0' }]);
    else setDeductions([...deductions, { name: '', amount: '0' }]);
  };

  const updateComponent = (type: 'allowance' | 'deduction', idx: number, field: string, value: string) => {
    const list = type === 'allowance' ? [...allowances] : [...deductions];
    list[idx][field] = value;
    if (type === 'allowance') setAllowances(list);
    else setDeductions(list);
  };

  const removeComponent = (type: 'allowance' | 'deduction', idx: number) => {
    if (type === 'allowance') setAllowances(allowances.filter((_, i) => i !== idx));
    else setDeductions(deductions.filter((_, i) => i !== idx));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) { toast.error("Select staff first"); return; }
    setSubmitting(true);

    const allowObj = allowances.reduce((acc: any, curr) => {
      if (curr.name && curr.amount) acc[curr.name] = Number(curr.amount);
      return acc;
    }, {});

    const dedObj = deductions.reduce((acc: any, curr) => {
      if (curr.name && curr.amount) acc[curr.name] = Number(curr.amount);
      return acc;
    }, {});

    try {
      // Upsert: First try to update, if 0 rows returned, insert
      const { data: existing } = await supabase.from('staff_salary_config').select('id').eq('staff_id', selectedStaffId).maybeSingle();

      if (existing) {
        const { error } = await supabase.from('staff_salary_config').update({
          basic_salary: Number(basicSalary),
          allowances: allowObj,
          deductions: dedObj,
          effective_from: new Date().toISOString().split('T')[0]
        }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('staff_salary_config').insert({
          staff_id: selectedStaffId,
          basic_salary: Number(basicSalary),
          allowances: allowObj,
          deductions: dedObj,
          effective_from: new Date().toISOString().split('T')[0]
        });
        if (error) throw error;
      }
      toast.success("Salary Configuration Saved!");
    } catch (err: any) {
      if (err?.code === '23503') {
         toast.error("Database Error: Foreign Key Constraint. Please tell your developer to run 'ALTER TABLE staff_salary_config DROP CONSTRAINT staff_salary_config_staff_id_fkey'");
      } else {
         toast.error(err?.message || "Failed to save configuration");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const gross = Number(basicSalary) + allowances.reduce((sum, a) => sum + Number(a.amount || 0), 0);
  const totalDed = deductions.reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const net = gross - totalDed;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-heading mb-1">Salary Configuration</h1>
        <p className="text-muted-foreground text-sm mt-1">Set basic salary, allowances and deductions for teachers & staff.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8 shadow-none border border-border/50 rounded-2xl overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border/50">
            <CardTitle className="text-lg font-bold text-foreground">Staff Configuration</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSave} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Select Teacher / Staff</Label>
                <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                  <SelectTrigger className="h-11 rounded-xl bg-muted border-0 font-bold text-foreground focus:ring-1 focus:ring-ring/30 shadow-none"><SelectValue placeholder="Select staff member..." /></SelectTrigger>
                  <SelectContent className="border-border/50 rounded-xl shadow-md max-h-[300px]">
                    {staffList.map(s => (
                      <SelectItem key={s.id} value={s.id} className="rounded-lg font-medium">{s.name} {s.designation ? `(${s.designation})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {loadingConfig ? (
                <div className="flex justify-center py-6"><SpinnerGap size={24} strokeWidth={2} className="animate-spin text-muted-foreground/40" /></div>
              ) : selectedStaffId && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                  <div className="space-y-2 border border-border/50 p-5 rounded-2xl bg-muted/50/30">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1 block mb-3">Basic Salary</Label>
                    <Input type="number" className="w-48 font-mono text-lg font-black h-11 rounded-xl bg-white border border-border/50 shadow-none focus-visible:ring-1 focus-visible:ring-ring/30" value={basicSalary} onChange={e => setBasicSalary(e.target.value)} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Allowances */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Allowances (+)</Label>
                        <Button type="button" variant="ghost" size="sm" className="h-8 px-3 text-xs bg-muted hover:bg-muted/80 text-muted-foreground font-bold rounded-lg shadow-none" onClick={() => addComponent('allowance')}>
                          <Plus size={14} strokeWidth={2.5} className="mr-1" /> Add
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {allowances.map((c, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Input placeholder="E.g. House Rent" className="flex-1 h-11 rounded-xl bg-muted border-0 font-bold text-foreground focus-visible:ring-1 focus-visible:ring-ring/30 shadow-none" value={c.name} onChange={e => updateComponent('allowance', i, 'name', e.target.value)} />
                            <Input type="number" placeholder="0" className="w-24 font-mono font-bold h-11 rounded-xl bg-muted border-0 text-foreground focus-visible:ring-1 focus-visible:ring-ring/30 shadow-none" value={c.amount} onChange={e => updateComponent('allowance', i, 'amount', e.target.value)} />
                            <Button type="button" variant="ghost" size="icon" className="h-11 w-11 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl" onClick={() => removeComponent('allowance', i)}><Trash size={16} strokeWidth={2} /></Button>
                          </div>
                        ))}
                        {allowances.length === 0 && <p className="text-xs font-bold text-muted-foreground/60 italic">No allowances added.</p>}
                      </div>
                    </div>

                    {/* Deductions */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Deductions (-)</Label>
                        <Button type="button" variant="ghost" size="sm" className="h-8 px-3 text-xs bg-muted hover:bg-muted/80 text-muted-foreground font-bold rounded-lg shadow-none" onClick={() => addComponent('deduction')}>
                          <Plus size={14} strokeWidth={2.5} className="mr-1" /> Add
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {deductions.map((c, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Input placeholder="E.g. Tax / Prov. Fund" className="flex-1 h-11 rounded-xl bg-muted border-0 font-bold text-foreground focus-visible:ring-1 focus-visible:ring-ring/30 shadow-none" value={c.name} onChange={e => updateComponent('deduction', i, 'name', e.target.value)} />
                            <Input type="number" placeholder="0" className="w-24 font-mono font-bold h-11 rounded-xl bg-muted border-0 text-red-500 focus-visible:ring-1 focus-visible:ring-ring/30 shadow-none" value={c.amount} onChange={e => updateComponent('deduction', i, 'amount', e.target.value)} />
                            <Button type="button" variant="ghost" size="icon" className="h-11 w-11 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl" onClick={() => removeComponent('deduction', i)}><Trash size={16} strokeWidth={2} /></Button>
                          </div>
                        ))}
                        {deductions.length === 0 && <p className="text-xs font-bold text-muted-foreground/60 italic">No deductions added.</p>}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-5 border-t border-border/50 items-center">
                    {userRole !== 'admin' && <span className="text-xs font-bold text-red-500 mr-4">Only Admin can change configuration.</span>}
                    <Button type="submit" className="h-11 px-6 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold shadow-none" disabled={submitting || userRole !== 'admin'}>
                      {submitting ? <SpinnerGap size={16} strokeWidth={2} className="mr-2 animate-spin" /> : <CheckCircle size={16} strokeWidth={2} className="mr-2" />}
                      {submitting ? "Saving..." : "Save Configuration"}
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {selectedStaffId && (
          <Card className="lg:col-span-4 shadow-none border border-border/50 rounded-2xl h-fit bg-card text-foreground">
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/30">
              <CardTitle className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-bold">Basic</span>
                <span className="font-mono font-bold text-foreground">{Number(basicSalary).toLocaleString('en-IN')} TK</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-bold">Total Allowances</span>
                <span className="font-mono font-bold text-foreground">+{(gross - Number(basicSalary)).toLocaleString('en-IN')} TK</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-bold">Total Deductions</span>
                <span className="font-mono font-bold text-red-500">-{totalDed.toLocaleString('en-IN')} TK</span>
              </div>
              <div className="pt-4 mt-2 border-t border-border/50 flex justify-between items-center">
                <span className="font-bold text-foreground">Net Salary</span>
                <span className="font-black font-mono text-xl text-foreground">{net.toLocaleString('en-IN')} TK</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

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
import { Loader2, Plus, Trash2, CheckCircle2 } from 'lucide-react';

export default function SalaryConfigPage() {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [basicSalary, setBasicSalary] = useState("0");
  const [allowances, setAllowances] = useState<any[]>([]);
  const [deductions, setDeductions] = useState<any[]>([]);

  const supabase = createClient() as any;

  useEffect(() => {
    const fetchStaff = async () => {
      const { data } = await supabase.from('teachers').select('id, name, designation, phone').order('name');
      if (data) setStaffList(data);
    };
    fetchStaff();
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
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-violet-600 to-violet-400 bg-clip-text text-transparent">Salary Configuration</h1>
        <p className="text-muted-foreground text-sm mt-1">Set basic salary, allowances and deductions for teachers & staff.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8 border-none shadow-lg">
          <div className="h-1.5 bg-violet-500"></div>
          <CardHeader>
            <CardTitle className="text-lg">Staff Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-5">
              <div className="space-y-2">
                <Label className="uppercase text-xs font-semibold text-muted-foreground">Select Teacher / Staff</Label>
                <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                  <SelectTrigger className="bg-card"><SelectValue placeholder="Select staff member..." /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {staffList.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name} {s.designation ? `(${s.designation})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {loadingConfig ? (
                <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : selectedStaffId && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                  <div className="space-y-2">
                    <Label className="uppercase text-xs font-semibold text-muted-foreground border-b pb-1 flex w-full">Basic Salary</Label>
                    <Input type="number" dir="rtl" className="w-48 font-mono text-lg font-bold" value={basicSalary} onChange={e => setBasicSalary(e.target.value)} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Allowances */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b pb-1">
                        <Label className="uppercase text-xs font-semibold text-muted-foreground">Allowances (+)</Label>
                        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => addComponent('allowance')}>
                          <Plus className="w-3 h-3 mr-1" /> Add
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {allowances.map((c, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Input placeholder="E.g. House Rent" className="flex-1" value={c.name} onChange={e => updateComponent('allowance', i, 'name', e.target.value)} />
                            <Input type="number" dir="rtl" placeholder="0" className="w-24 font-mono" value={c.amount} onChange={e => updateComponent('allowance', i, 'amount', e.target.value)} />
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => removeComponent('allowance', i)}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        ))}
                        {allowances.length === 0 && <p className="text-xs text-muted-foreground italic">No allowances added.</p>}
                      </div>
                    </div>

                    {/* Deductions */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b pb-1">
                        <Label className="uppercase text-xs font-semibold text-muted-foreground">Deductions (-)</Label>
                        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => addComponent('deduction')}>
                          <Plus className="w-3 h-3 mr-1" /> Add
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {deductions.map((c, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Input placeholder="E.g. Tax / Prov. Fund" className="flex-1" value={c.name} onChange={e => updateComponent('deduction', i, 'name', e.target.value)} />
                            <Input type="number" dir="rtl" placeholder="0" className="w-24 font-mono text-red-600" value={c.amount} onChange={e => updateComponent('deduction', i, 'amount', e.target.value)} />
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => removeComponent('deduction', i)}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        ))}
                        {deductions.length === 0 && <p className="text-xs text-muted-foreground italic">No deductions added.</p>}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t">
                    <Button type="submit" className="px-6 shadow-md" disabled={submitting}>
                      {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                      {submitting ? "Saving..." : "Save Configuration"}
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {selectedStaffId && (
          <Card className="lg:col-span-4 border-none shadow-lg h-fit bg-slate-50">
            <CardHeader className="pb-3 border-b border-slate-200">
              <CardTitle className="text-base uppercase tracking-wider text-slate-500">Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="flex justify-between items-center text-sm font-medium">
                <span className="text-slate-600">Basic</span>
                <span className="font-mono">{Number(basicSalary).toLocaleString('en-IN')} TK</span>
              </div>
              <div className="flex justify-between items-center text-sm font-medium">
                <span className="text-slate-600">Total Allowances</span>
                <span className="font-mono text-primary">+{(gross - Number(basicSalary)).toLocaleString('en-IN')} TK</span>
              </div>
              <div className="flex justify-between items-center text-sm font-medium">
                <span className="text-slate-600">Total Deductions</span>
                <span className="font-mono text-red-600">-{totalDed.toLocaleString('en-IN')} TK</span>
              </div>
              <div className="pt-3 border-t-2 border-slate-200 flex justify-between items-center">
                <span className="font-bold text-slate-800">Net Salary</span>
                <span className="font-bold font-mono text-xl text-violet-700">{net.toLocaleString('en-IN')} TK</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

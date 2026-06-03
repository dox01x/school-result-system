'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { createClient } from '@/lib/supabase/client';
import { CLASS_COLUMNS } from '@/lib/supabase/select-columns';
import { Loader2 as SpinnerGap, Search as MagnifyingGlass, AlertTriangle as Warning, ExternalLink as ArrowSquareOut } from "lucide-react";
import { formatTaka, getMonthName } from '@/lib/finance-utils';
import Link from 'next/link';

export default function OverdueTuitionPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [overdueList, setOverdueList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [selectedClass, setSelectedClass] = useState('all');
  const [month, setMonth] = useState(currentMonth.toString());
  const [year, setYear] = useState(currentYear.toString());

  const supabase = createClient();

  useEffect(() => {
    const fetchClasses = async () => {
      const { data } = await supabase.from('classes').select(CLASS_COLUMNS).order('numeric_value');
      if (data) setClasses(data);
    };
    fetchClasses();
  }, []);

  const loadOverdue = async () => {
    if (!month || !year) { toast.error("Month and year are required"); return; }
    setLoading(true);
    try {
      let url = `/api/finance/tuition/overdue?month=${month}&year=${year}`;
      if (selectedClass !== 'all') url += `&class_name=${selectedClass}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setOverdueList(data.data);
      else toast.error(data.error || "Failed to fetch list");
    } catch {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const totalOutstanding = overdueList.reduce((s, item) => s + (item.outstanding || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-heading mb-1">Overdue Tuition</h1>
        <p className="text-muted-foreground text-sm mt-1">Identify students with pending tuition fees.</p>
      </div>

      {/* Funnels */}
      <Card className="bg-card rounded-2xl border border-border/50 shadow-none">
        <CardContent className="p-5 flex flex-col sm:flex-row items-end gap-4">
          <div className="space-y-2 w-full sm:w-48">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Class</Label>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="h-11 rounded-xl bg-muted border-0 font-bold text-foreground focus:ring-1 focus:ring-ring/30 shadow-none"><SelectValue /></SelectTrigger>
              <SelectContent className="border-border/50 rounded-xl shadow-md">
                <SelectItem value="all" className="rounded-lg font-medium">All Classes</SelectItem>
                {classes.map(c => <SelectItem key={c.id} value={c.name} className="rounded-lg font-medium">{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 w-full sm:w-40">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Month</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="h-11 rounded-xl bg-muted border-0 font-bold text-foreground focus:ring-1 focus:ring-ring/30 shadow-none"><SelectValue /></SelectTrigger>
              <SelectContent className="border-border/50 rounded-xl shadow-md">
                {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                  <SelectItem key={m} value={m.toString()} className="rounded-lg font-medium">{getMonthName(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 w-full sm:w-32">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Year</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="h-11 rounded-xl bg-muted border-0 font-bold text-foreground focus:ring-1 focus:ring-ring/30 shadow-none"><SelectValue /></SelectTrigger>
              <SelectContent className="border-border/50 rounded-xl shadow-md">
                {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                  <SelectItem key={y} value={y.toString()} className="rounded-lg font-medium">{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={loadOverdue} disabled={loading} className="h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold shadow-none px-6">
            {loading ? <SpinnerGap size={16} strokeWidth={2} className="mr-2 animate-spin" /> : <MagnifyingGlass size={16} strokeWidth={2.5} className="mr-2" />}
            Search
          </Button>
          {overdueList.length > 0 && (
            <div className="ml-auto flex items-center gap-2 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
              <Warning size={16} strokeWidth={2.5} className="text-red-500" />
              <span className="text-sm font-bold text-red-600">
                {overdueList.length} student(s) • {formatTaka(totalOutstanding)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* List */}
      <Card className="bg-card rounded-2xl border border-border/50 shadow-none overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-12"><SpinnerGap size={24} strokeWidth={2} className="animate-spin text-muted-foreground/40" /></div>
          ) : overdueList.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Warning size={48} strokeWidth={1.5} className="mx-auto mb-3 text-muted-foreground/40" />
              <p className="font-bold">No overdue students found</p>
              <p className="text-xs font-bold text-muted-foreground/60 mt-1">Click "Search" to check for overdue fees</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 border-border/50 hover:bg-muted/30">
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Student</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Class</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">Due</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">Paid</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">Outstanding</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">Days</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueList.map(item => (
                  <TableRow key={item.student_info?.id || Math.random()} className="border-border/50 hover:bg-muted/30">
                    <TableCell>
                      <p className="font-bold text-sm text-foreground">{item.student_info?.name}</p>
                      <p className="text-[10px] font-bold text-muted-foreground/60">Roll: {item.student_info?.roll || 'N/A'}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-muted text-muted-foreground border-border/50 text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-md shadow-none">{item.class_name}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-foreground text-sm">{formatTaka(item.amount_due)}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-muted-foreground text-sm">{formatTaka(item.amount_paid)}</TableCell>
                    <TableCell className="text-right font-mono font-black text-red-500 text-sm">{formatTaka(item.outstanding)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className={`border-0 uppercase tracking-widest font-bold shadow-none rounded-md px-2 py-0.5 text-[9px] ${item.days_overdue > 30 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                        {item.days_overdue}d
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/dashboard/finance/tuition/collect?student_id=${item.student_info?.id}`}>
                        <Button size="sm" variant="outline" className="h-8 px-3 rounded-lg border-border/50 bg-white hover:bg-muted/50 text-foreground font-bold shadow-none text-[10px] gap-1.5 ml-auto">
                          Collect <ArrowSquareOut className="w-3 h-3" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

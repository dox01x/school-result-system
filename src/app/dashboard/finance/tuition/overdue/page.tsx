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
import { Loader2, Search, AlertTriangle, ExternalLink } from 'lucide-react';
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
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-amber-600 to-amber-400 bg-clip-text text-transparent">Overdue Tuition</h1>
        <p className="text-muted-foreground text-sm mt-1">Identify students with pending tuition fees.</p>
      </div>

      {/* Filter */}
      <Card className="border-none shadow-md">
        <CardContent className="p-4 flex flex-col sm:flex-row items-end gap-4">
          <div className="space-y-1 w-full sm:w-48">
            <Label className="text-[10px] text-muted-foreground uppercase">Class</Label>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 w-full sm:w-40">
            <Label className="text-[10px] text-muted-foreground uppercase">Month</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                  <SelectItem key={m} value={m.toString()}>{getMonthName(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 w-full sm:w-32">
            <Label className="text-[10px] text-muted-foreground uppercase">Year</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={loadOverdue} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
            Search
          </Button>
          {overdueList.length > 0 && (
            <div className="ml-auto flex items-center gap-2 bg-red-50 border border-red-200 px-4 py-2 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-sm font-bold text-red-700">
                {overdueList.length} student(s) • {formatTaka(totalOutstanding)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* List */}
      <Card className="border-none shadow-lg">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : overdueList.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-semibold">No overdue students found</p>
              <p className="text-sm mt-1">Click "Search" to check for overdue fees</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs">Student</TableHead>
                  <TableHead className="text-xs">Class</TableHead>
                  <TableHead className="text-xs text-right">Due</TableHead>
                  <TableHead className="text-xs text-right">Paid</TableHead>
                  <TableHead className="text-xs text-right">Outstanding</TableHead>
                  <TableHead className="text-xs text-right">Days</TableHead>
                  <TableHead className="text-xs text-right w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueList.map(item => (
                  <TableRow key={item.student_info?.id || Math.random()}>
                    <TableCell>
                      <p className="font-semibold text-sm">{item.student_info?.name}</p>
                      <p className="text-[10px] text-muted-foreground">Roll: {item.student_info?.roll || item.student_info?.roll_no || 'N/A'}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{item.class_name}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatTaka(item.amount_due)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-primary">{formatTaka(item.amount_paid)}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-red-600">{formatTaka(item.outstanding)}</TableCell>
                    <TableCell className="text-right">
                      <Badge className={`text-[10px] ${item.days_overdue > 30 ? 'bg-red-100 text-red-700 hover:bg-red-100' : 'bg-amber-100 text-amber-700 hover:bg-amber-100'}`}>
                        {item.days_overdue}d
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href="/dashboard/finance/tuition/collect">
                        <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1">
                          Collect <ExternalLink className="w-3 h-3" />
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

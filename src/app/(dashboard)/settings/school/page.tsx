"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, Save, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export default function SchoolSettingsPage() {
  const [schoolName, setSchoolName] = useState("EduPulse Model Academy");
  const [address, setAddress] = useState("House 12, Road 4, Dhanmondi, Dhaka");
  const [phone, setPhone] = useState("+880 1700-000000");
  const [email, setEmail] = useState("contact@edupulse.edu.bd");
  const [academicYear, setAcademicYear] = useState("2026");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadSchoolInfo() {
      const supabase = createClient();
      const { data } = await supabase.from("school_info").select("*").single();
      if (data) {
        if (data.name) setSchoolName(data.name);
        if (data.address) setAddress(data.address);
        if (data.phone) setPhone(data.phone);
        if (data.email) setEmail(data.email);
        const year = (data as any).current_academic_year || (data as any).academic_year;
        if (year) setAcademicYear(year);
      }
    }
    loadSchoolInfo();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const supabase = createClient();
      await (supabase as any).from("school_info").upsert([
        {
          name: schoolName,
          address,
          phone,
          email,
          current_academic_year: academicYear,
        },
      ]);
      toast.success("School information saved successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Settings", href: "/settings" },
          { label: "School Profile" },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">School Profile & Identity</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure institutional details appearing on marksheets, fee receipts, and official PDFs.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/settings">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Settings
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" /> General School Details
          </CardTitle>
          <CardDescription>Update your school name, contact information, and current session.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="schoolName">School / Institute Name</Label>
                <Input
                  id="schoolName"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="academicYear">Active Academic Session</Label>
                <Input
                  id="academicYear"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone">Official Contact Phone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Official Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="address">Address & Campus Location</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button type="submit" disabled={saving} className="gap-2">
                <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

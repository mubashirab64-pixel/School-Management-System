"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, ShieldCheck, Lock, Activity, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { feeService, FeeType } from "@/services/feeService";
import { FeeTabs } from "../components/FeeTabs";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function FeeTypesPage() {
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<any>("monthly");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchFeeTypes = async () => {
    setLoading(true);
    try {
      const data = await feeService.getFeeTypes();
      setFeeTypes(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load fee types");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeeTypes();
  }, []);

  const handleAddFeeType = async () => {
    if (!name) {
      toast.error("Please enter fee name");
      return;
    }
    setSubmitting(true);
    try {
      await feeService.createFeeType({ name, frequency, is_default: false, is_active: true });
      toast.success("Fee type added successfully");
      setIsModalOpen(false);
      setName("");
      setFrequency("monthly");
      setDescription("");
      fetchFeeTypes();
    } catch (error) {
      toast.error("Failed to add fee type");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this fee type?")) {
      try {
        await feeService.deleteFeeType(id);
        toast.success("Fee type deleted");
        fetchFeeTypes();
      } catch (error) {
        toast.error("Failed to delete fee type");
      }
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div>
        <h2 className="text-3xl font-extrabold text-[#274c77] mb-2 tracking-wide flex items-center gap-3">
          <Activity className="h-8 w-8 text-[#6096ba]" />
          Fee Types Management
        </h2>
        <p className="text-gray-600 text-lg">Define and categorize the types of fees collected from students.</p>
      </div>

      <FeeTabs active="fee-types" />

      <div className="flex justify-end">
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#274c77] hover:bg-[#1e3a5f] text-white">
              <Plus className="w-4 h-4 mr-2" /> Add New Fee Type
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Custom Fee Type</DialogTitle>
              <DialogDescription>Create a new fee category for your school.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Fee Name</Label>
                <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Computer Science Fee" />
              </div>
              <div className="grid gap-2">
                <Label>Frequency</Label>
                <RadioGroup value={frequency} onValueChange={setFrequency} className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="daily" id="f-daily" />
                    <Label htmlFor="f-daily">Daily</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="monthly" id="f-monthly" />
                    <Label htmlFor="f-monthly">Monthly</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yearly" id="f-yearly" />
                    <Label htmlFor="f-yearly">Yearly</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="one_time" id="f-onetime" />
                    <Label htmlFor="f-onetime">One-Time</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="desc">Description (Optional)</Label>
                <Textarea id="desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Extra details about this fee..." />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddFeeType} disabled={submitting} className="bg-[#274c77]">
                {submitting ? "Saving..." : "Save Fee Type"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-xl bg-white overflow-hidden">
        <CardHeader className="bg-blue-50/50">
          <CardTitle className="text-[#274c77] flex items-center gap-2">
            <Activity className="w-5 h-5" /> All Fee Types
          </CardTitle>
          <CardDescription>Manage all fee types applied during challan generation.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="font-bold">Fee Name</TableHead>
                <TableHead className="font-bold">Frequency</TableHead>
                <TableHead className="font-bold">Status</TableHead>
                <TableHead className="text-right font-bold flex-shrink-0 w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feeTypes.map((fee) => (
                <TableRow key={fee.id}>
                  <TableCell className="font-medium text-[#274c77]">{fee.name}</TableCell>
                  <TableCell className="capitalize">{fee.frequency.replace('_', ' ')}</TableCell>
                  <TableCell>
                    <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">Active</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2 w-[100px]">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDelete(fee.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {feeTypes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-gray-500">
                    <div className="flex flex-col items-center">
                      <Info className="w-10 h-10 mb-2 opacity-20" />
                      <p>No fee types defined yet.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

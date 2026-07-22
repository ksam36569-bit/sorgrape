import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const DepartmentDialog = ({ open, onOpenChange, initial, onSubmit }) => {
  const [name, setName] = useState("");

  React.useEffect(() => {
    setName(initial?.name || "");
  }, [initial, open]);

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Department name is required");
      return;
    }
    await onSubmit(name.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{initial ? "Rename department" : "New department"}</DialogTitle>
        </DialogHeader>
        <div className="pt-2 space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => e.key === "Enter" && submit()} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>{initial ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DepartmentDialog;

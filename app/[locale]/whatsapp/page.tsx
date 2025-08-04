"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

export default function WhatsAppPage() {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone, messageData: { text: message } }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Message sent!", description: "Your WhatsApp message was sent successfully." });
      } else {
        toast({ title: "Failed to send", description: data.error || "Unknown error.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">WhatsApp Integration</h1>
      <p className="mb-2">Send and receive blood donation requests and alerts via WhatsApp.</p>
      <div className="mb-4">
        <label className="block mb-1">Phone Number</label>
        <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. +244923668856" />
      </div>
      <div className="mb-4">
        <label className="block mb-1">Message</label>
        <Input value={message} onChange={e => setMessage(e.target.value)} placeholder="Type your message..." />
      </div>
      <Button onClick={handleSend} disabled={isLoading} className="w-full">
        {isLoading ? "Sending..." : "Send WhatsApp Message"}
      </Button>
      <div className="mt-8 p-4 bg-gray-50 rounded">
        <h2 className="font-semibold mb-2">How to use WhatsApp with BloodLink Africa</h2>
        <ol className="list-decimal ml-5 space-y-1">
          <li>Save our WhatsApp number in your contacts: <b>+244 923 668 856</b></li>
          <li>Send <b>HELP</b> to get a list of available commands.</li>
          <li>Send <b>REQUEST</b> to request blood.</li>
          <li>Send <b>STATUS</b> to check your request status.</li>
          <li>Send <b>AVAILABLE</b> or <b>UNAVAILABLE</b> to update your donor status.</li>
        </ol>
      </div>
    </div>
  );
} 
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";

export function EmailTemplate() {
  return (
    <div className="max-w-2xl mx-auto bg-background text-foreground p-8 font-sans shadow-sm border rounded-xl my-8">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-primary-foreground p-2 rounded-md text-xl font-bold flex items-center justify-center w-10 h-10">
            BF
          </div>
          <div>
            <div className="font-bold text-lg leading-tight">BorderFlow</div>
            <div className="text-sm text-muted-foreground leading-tight">Control Tower</div>
          </div>
        </div>
        <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-transparent">
          Created
        </Badge>
      </div>

      {/* BODY */}
      <div className="space-y-8">
        {/* GREETING */}
        <div>
          <div className="text-lg mb-1">
            Hello <strong className="font-semibold">Alejandro Zamudio</strong>,
          </div>
          <p className="text-muted-foreground text-sm">
            A new shipment has been created and is now being processed. Here's a summary of the entry details.
          </p>
        </div>

        {/* ROUTE VISUAL */}
        <div className="flex items-center justify-between bg-slate-50 border border-slate-100 p-6 rounded-lg">
          <div className="text-center w-24">
            <div className="w-3 h-3 rounded-full bg-blue-600 mx-auto mb-2 ring-4 ring-blue-100"></div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Origin</div>
            <div className="text-sm font-medium">Mexico City, MX</div>
          </div>
          
          <div className="flex-1 mx-4 relative flex flex-col items-center">
            <div className="w-full flex items-center mb-2">
              <div className="flex-1 border-t-2 border-dashed border-slate-200"></div>
              <svg className="w-4 h-4 text-slate-300 mx-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="text-xs text-muted-foreground relative -top-1">
              Truck · Port 2304 (Laredo)
            </div>
          </div>

          <div className="text-center w-24">
            <div className="w-3 h-3 rounded-full border-2 border-slate-300 mx-auto mb-2 bg-white"></div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Destination</div>
            <div className="text-sm font-medium">Laredo, TX</div>
          </div>
        </div>

        {/* SHIPMENT DETAIL CARD */}
        <Card className="shadow-none border-slate-200">
          <CardHeader className="pb-3 pt-4 px-5 flex flex-row items-center justify-between border-b bg-slate-50/50">
            <CardTitle className="text-base font-semibold m-0">Shipment Details</CardTitle>
            <div className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">
              BF-25-0852
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Entry Number</p>
                <p className="font-mono text-sm font-medium">00042076</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Bill of Lading</p>
                <p className="font-mono text-sm font-medium">0099059259</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Type</p>
                <p className="font-medium text-sm">Mexico → U.S. (Import)</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Quantity</p>
                <p className="font-mono text-sm font-medium">30 units</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Customer Ref</p>
                <p className="font-mono text-sm font-medium">548547699</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Broker</p>
                <p className="font-medium text-sm">Border Bridge LLC</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* STATUS CHIPS */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 p-3 rounded-lg">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></div>
            <div>
              <div className="text-[10px] uppercase font-semibold text-amber-700/70">Status</div>
              <div className="text-sm font-medium text-amber-900 leading-tight">Processing</div>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 p-3 rounded-lg">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
            <div>
              <div className="text-[10px] uppercase font-semibold text-emerald-700/70">Risk</div>
              <div className="text-sm font-medium text-emerald-900 leading-tight">Low</div>
            </div>
          </div>
        </div>

        {/* NEXT STEPS */}
        <div>
          <h3 className="font-semibold text-sm mb-4">What happens next</h3>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-medium">
                1
              </div>
              <div className="text-sm text-slate-600 pt-0.5">
                <strong className="text-foreground font-semibold">ISF Filing</strong> — will be submitted within 24 hours of creation.
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-medium">
                2
              </div>
              <div className="text-sm text-slate-600 pt-0.5">
                <strong className="text-foreground font-semibold">Document Review</strong> — upload commercial invoice and packing list to complete the entry.
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-medium">
                3
              </div>
              <div className="text-sm text-slate-600 pt-0.5">
                <strong className="text-foreground font-semibold">CBP Processing</strong> — you'll be notified when ACE release is issued.
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-4 pt-4">
          <a href="#" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
            View Shipment in Dashboard &rarr;
          </a>
          <p className="text-xs text-muted-foreground">
            Or reply to this email to reach <a href="#" className="text-primary hover:underline font-medium">Border Bridge LLC</a>
          </p>
        </div>
      </div>

      {/* FOOTER */}
      <div className="mt-12 pt-8 border-t text-center space-y-4">
        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <a href="#" className="hover:text-foreground transition-colors">Help Center</a>
          <a href="#" className="hover:text-foreground transition-colors">Settings</a>
          <a href="#" className="hover:text-foreground transition-colors">Support</a>
        </div>
        <p className="text-xs text-slate-400">© 2026 Border Flow, LLC</p>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          You received this because you're subscribed to shipment alerts. <a href="#" className="underline hover:text-foreground">Unsubscribe</a>
        </p>
      </div>
    </div>
  );
}

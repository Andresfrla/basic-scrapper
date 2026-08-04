export const shipmentCreatedTemplate = (data: any) => {
  return `
    <div class="max-w-2xl mx-auto bg-background text-foreground p-8 font-sans shadow-sm border rounded-xl my-8">
      <!-- HEADER -->
      <div class="flex justify-between items-center mb-8 border-b pb-4">
        <div class="flex items-center gap-3">
          <div class="bg-primary text-primary-foreground p-2 rounded-md text-xl font-bold flex items-center justify-center w-10 h-10">
            BF
          </div>
          <div>
            <div class="font-bold text-lg leading-tight">BorderFlow</div>
            <div class="text-sm text-muted-foreground leading-tight">Control Tower</div>
          </div>
        </div>
        <div class="bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full text-xs font-semibold">
          Created
        </div>
      </div>

      <!-- BODY -->
      <div class="space-y-8">
        <!-- GREETING -->
        <div>
          <div class="text-lg mb-1">
            Hello <strong class="font-semibold">Alejandro Zamudio</strong>,
          </div>
          <p class="text-muted-foreground text-sm">
            A new shipment has been created and is now being processed. Here's a summary of the entry details.
          </p>
        </div>

        <!-- ROUTE VISUAL -->
        <div class="flex items-center justify-between bg-slate-50 border border-slate-100 p-6 rounded-lg">
          <div class="text-center w-24">
            <div class="w-3 h-3 rounded-full bg-blue-600 mx-auto mb-2 ring-4 ring-blue-100"></div>
            <div class="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Origin</div>
            <div class="text-sm font-medium">Mexico City, MX</div>
          </div>
          
          <div class="flex-1 mx-4 relative flex flex-col items-center">
            <div class="w-full flex items-center mb-2">
              <div class="flex-1 border-t-2 border-dashed border-slate-200"></div>
              <svg class="w-4 h-4 text-slate-300 mx-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div class="text-xs text-muted-foreground relative -top-1">
              Truck · Port 2304 (Laredo)
            </div>
          </div>

          <div class="text-center w-24">
            <div class="w-3 h-3 rounded-full border-2 border-slate-300 mx-auto mb-2 bg-white"></div>
            <div class="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Destination</div>
            <div class="text-sm font-medium">Laredo, TX</div>
          </div>
        </div>

        <!-- SHIPMENT DETAIL CARD -->
        <div class="border border-slate-200 rounded-lg shadow-sm">
          <div class="pb-3 pt-4 px-5 flex flex-row items-center justify-between border-b bg-slate-50/50 rounded-t-lg">
            <h3 class="text-base font-semibold m-0">Shipment Details</h3>
            <div class="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">
              BF-25-0852
            </div>
          </div>
          <div class="p-5">
            <div class="grid grid-cols-2 gap-y-4 gap-x-6">
              <div>
                <p class="text-xs text-muted-foreground mb-1">Entry Number</p>
                <p class="font-mono text-sm font-medium">00042076</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground mb-1">Bill of Lading</p>
                <p class="font-mono text-sm font-medium">0099059259</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground mb-1">Type</p>
                <p class="font-medium text-sm">Mexico &rarr; U.S. (Import)</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground mb-1">Quantity</p>
                <p class="font-mono text-sm font-medium">30 units</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground mb-1">Customer Ref</p>
                <p class="font-mono text-sm font-medium">548547699</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground mb-1">Broker</p>
                <p class="font-medium text-sm">Border Bridge LLC</p>
              </div>
            </div>
          </div>
        </div>

        <!-- STATUS CHIPS -->
        <div class="grid grid-cols-2 gap-4">
          <div class="flex items-center gap-3 bg-amber-50 border border-amber-100 p-3 rounded-lg">
            <div class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></div>
            <div>
              <div class="text-[10px] uppercase font-semibold text-amber-700/70">Status</div>
              <div class="text-sm font-medium text-amber-900 leading-tight">Processing</div>
            </div>
          </div>
          <div class="flex items-center gap-3 bg-emerald-50 border border-emerald-100 p-3 rounded-lg">
            <div class="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
            <div>
              <div class="text-[10px] uppercase font-semibold text-emerald-700/70">Risk</div>
              <div class="text-sm font-medium text-emerald-900 leading-tight">Low</div>
            </div>
          </div>
        </div>

        <!-- NEXT STEPS -->
        <div>
          <h3 class="font-semibold text-sm mb-4">What happens next</h3>
          <div class="space-y-4">
            <div class="flex gap-4">
              <div class="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-medium">
                1
              </div>
              <div class="text-sm text-slate-600 pt-0.5">
                <strong class="text-foreground font-semibold">ISF Filing</strong> &mdash; will be submitted within 24 hours of creation.
              </div>
            </div>
            <div class="flex gap-4">
              <div class="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-medium">
                2
              </div>
              <div class="text-sm text-slate-600 pt-0.5">
                <strong class="text-foreground font-semibold">Document Review</strong> &mdash; upload commercial invoice and packing list to complete the entry.
              </div>
            </div>
            <div class="flex gap-4">
              <div class="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-medium">
                3
              </div>
              <div class="text-sm text-slate-600 pt-0.5">
                <strong class="text-foreground font-semibold">CBP Processing</strong> &mdash; you'll be notified when ACE release is issued.
              </div>
            </div>
          </div>
        </div>

        <!-- CTA -->
        <div class="flex flex-col items-center gap-4 pt-4">
          <a href="#" class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 text-decoration-none">
            View Shipment in Dashboard &rarr;
          </a>
          <p class="text-xs text-muted-foreground">
            Or reply to this email to reach <a href="#" class="text-primary hover:underline font-medium">Border Bridge LLC</a>
          </p>
        </div>
      </div>

      <!-- FOOTER -->
      <div class="mt-12 pt-8 border-t text-center space-y-4">
        <div class="flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <a href="#" class="hover:text-foreground transition-colors">Help Center</a>
          <a href="#" class="hover:text-foreground transition-colors">Settings</a>
          <a href="#" class="hover:text-foreground transition-colors">Support</a>
        </div>
        <p class="text-xs text-slate-400">&copy; 2026 Border Flow, LLC</p>
        <p class="text-xs text-slate-400 max-w-sm mx-auto">
          You received this because you're subscribed to shipment alerts. <a href="#" class="underline hover:text-foreground">Unsubscribe</a>
        </p>
      </div>
    </div>
  \`;
};

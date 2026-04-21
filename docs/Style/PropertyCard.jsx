import { MapPin, Bed, Bath, Square, Heart } from "lucide-react";

/**
 * PropertyCard — worked example of the glass design system.
 *
 * Key patterns to reuse everywhere:
 * 1. .glass-card for the main surface
 * 2. .glass-subtle for nested info panels
 * 3. .glass-button for interactive elements
 * 4. Text colour uses near-black with slight transparency
 *    (text-slate-900/90) — pure black looks harsh on glass
 * 5. Secondary text uses lower opacity of the same hue,
 *    never a separate grey value
 */
export default function PropertyCard({
  image = "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800",
  price = "£650,000",
  title = "Garden Flat, Sittingbourne",
  address = "12 Elm Road, ME10",
  beds = 3,
  baths = 2,
  sqft = 1240,
}) {
  return (
    // Page wrapper — glass-page-bg gives the coloured wash
    // that makes the glass effect visible. Without something
    // visually interesting behind the card, glass looks flat.
    <div className="glass-page-bg p-8 flex items-center justify-center">

      {/* Main property card — the primary glass surface */}
      <div className="glass-card max-w-md w-full overflow-hidden">

        {/* Hero image — sits inside the card, clipped to radius */}
        <div className="relative h-64 -m-[1px] mb-0">
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover"
            style={{ borderRadius: "20px 20px 0 0" }}
          />

          {/* Floating favourite button — glass-button over image
              demonstrates how glass reads on busy backgrounds */}
          <button
            className="glass-button absolute top-4 right-4 w-10 h-10 flex items-center justify-center"
            aria-label="Save property"
          >
            <Heart className="w-5 h-5 text-slate-900/80" />
          </button>

          {/* Price badge — also glass, sits on the image */}
          <div className="glass-button absolute bottom-4 left-4 px-4 py-2">
            <span className="text-slate-900/90 font-semibold text-lg">
              {price}
            </span>
          </div>
        </div>

        {/* Card body */}
        <div className="p-6">

          {/* Title and address */}
          <h2 className="text-slate-900/90 text-xl font-semibold tracking-tight">
            {title}
          </h2>
          <div className="flex items-center gap-1.5 mt-1 text-slate-900/60">
            <MapPin className="w-4 h-4" />
            <span className="text-sm">{address}</span>
          </div>

          {/* Nested info panel — uses glass-subtle for the
              layered-glass effect. This is a subtle but important
              detail: nested surfaces should be LESS blurred than
              their parent, not more. */}
          <div className="glass-subtle mt-5 p-4 flex items-center justify-around">
            <InfoStat icon={Bed} value={beds} label="beds" />
            <Divider />
            <InfoStat icon={Bath} value={baths} label="baths" />
            <Divider />
            <InfoStat icon={Square} value={sqft.toLocaleString()} label="sqft" />
          </div>

          {/* Action buttons — primary and secondary */}
          <div className="flex gap-3 mt-5">
            <button className="glass-button flex-1 py-3 text-slate-900/90 font-medium">
              View details
            </button>
            <button className="flex-1 py-3 rounded-xl bg-slate-900/90 text-white font-medium hover:bg-slate-900 transition-colors">
              Book viewing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────── */

function InfoStat({ icon: Icon, value, label }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Icon className="w-4 h-4 text-slate-900/60" />
      <div className="flex items-baseline gap-1">
        <span className="text-slate-900/90 font-semibold">{value}</span>
        <span className="text-slate-900/60 text-xs">{label}</span>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-8 bg-slate-900/10" />;
}

// components/DockStatusCard.jsx
import { Clock, Users, Coffee, Power, AlertCircle, Package } from "lucide-react";

const DockStatusSection = ({ dock }) => {
  const getStatusConfig = (status) => {
    const configs = {
      "SIBUK/ISTIRAHAT": {
        color: "bg-amber-50/50 dark:bg-amber-900/10",
        borderColor: "border-amber-200 dark:border-amber-800",
        textColor: "text-amber-700 dark:text-amber-400",
        badgeColor: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400",
        icon: Coffee,
        iconColor: "text-amber-500",
        label: "Istirahat",
      },
      KOSONG: {
        color: "bg-emerald-50/50 dark:bg-emerald-900/10",
        borderColor: "border-emerald-200 dark:border-emerald-800",
        textColor: "text-emerald-700 dark:text-emerald-400",
        badgeColor: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400",
        icon: Users,
        iconColor: "text-emerald-500",
        label: "Tersedia",
      },
      "TIDAK AKTIF": {
        color: "bg-gray-50 dark:bg-gray-800/50",
        borderColor: "border-gray-200 dark:border-gray-700",
        textColor: "text-gray-500 dark:text-gray-400",
        badgeColor: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
        icon: Power,
        iconColor: "text-gray-400",
        label: "Tidak Aktif",
      },
      "SEDANG MEMBONGKAR": {
        color: "bg-blue-50/50 dark:bg-blue-900/10",
        borderColor: "border-blue-200 dark:border-blue-800",
        textColor: "text-blue-700 dark:text-blue-400",
        badgeColor: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400",
        icon: Package,
        iconColor: "text-blue-500",
        label: "Bongkar",
      },
    };
    return configs[status] || configs["TIDAK AKTIF"];
  };

  const config = getStatusConfig(dock.status);
  const StatusIcon = config.icon;

  const formatRemainingTime = (minutes) => {
    if (minutes === undefined || minutes === null) return null;
    if (minutes <= 0) return "Selesai";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return remainingMins > 0 ? `${hours}j ${remainingMins}m` : `${hours}j`;
  };

  const remainingTime = formatRemainingTime(dock.remainingMinutes);
  
  // Calculate percentage for progress bar
  // Assuming 60 mins as a base for variety if it's not unloading, 
  // or use the durasiBongkar if it's SEDANG MEMBONGKAR
  const progressPercent = dock.status === "SEDANG MEMBONGKAR" 
    ? Math.max(0, Math.min(100, (1 - (dock.remainingMinutes || 0) / 60) * 100))
    : Math.max(0, Math.min(100, (1 - (dock.remainingMinutes || 0) / 60) * 100));

  return (
    <div
      className={`
      relative group
      ${config.color} 
      border ${config.borderColor}
      rounded-xl overflow-hidden
      transition-all duration-300
      hover:shadow-md hover:border-opacity-100
    `}
    >
      {/* Top Progress Indicator */}
      {(dock.status === "SIBUK/ISTIRAHAT" || dock.status === "SEDANG MEMBONGKAR") && (
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-100 dark:bg-gray-800">
          <div
            className={`h-full transition-all duration-1000 ease-linear ${
              dock.status === "SEDANG MEMBONGKAR" ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "bg-amber-500"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      <div className="p-4 pt-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm border ${config.borderColor} group-hover:scale-110 transition-transform`}>
              <StatusIcon className={`w-5 h-5 ${config.iconColor}`} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-base leading-tight">
                {dock.dockName}
              </h3>
            </div>
          </div>

          <span className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-full ${config.badgeColor} border ${config.borderColor}`}>
            {config.label}
          </span>
        </div>

        <div className="space-y-3">
          {dock.status === "SEDANG MEMBONGKAR" ? (
            <div className="bg-white/60 dark:bg-gray-800/60 p-2 rounded-lg border border-blue-100 dark:border-blue-900/50">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                  {dock.vendorName || "Vendor Unknown"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-blue-400" />
                  <span className="text-[10px] text-gray-500 uppercase font-medium">Sisa Waktu</span>
                </div>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {remainingTime}
                </span>
              </div>
            </div>
          ) : dock.status === "SIBUK/ISTIRAHAT" ? (
            <div className="flex items-center justify-between bg-amber-100/30 p-2 rounded-lg border border-amber-100 dark:border-amber-900/30">
              <span className="text-xs font-medium text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                <Coffee className="w-3.5 h-3.5" /> Berakhir dalam:
              </span>
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                {remainingTime}
              </span>
            </div>
          ) : dock.status === "KOSONG" ? (
            <div className="flex items-center justify-center py-4 bg-emerald-100/20 rounded-lg border border-dashed border-emerald-300 dark:border-emerald-800">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 uppercase tracking-wide">
                <CheckCircle className="w-4 h-4" /> Ready for Queue
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 py-2 text-gray-400">
              <AlertCircle className="w-4 h-4" />
              <p className="text-xs font-medium italic">Offline / Under Maintenance</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const CheckCircle = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default DockStatusSection;

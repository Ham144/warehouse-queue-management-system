import { MessageCircleQuestion } from "lucide-react";

interface SummaryCardProps {
  metric: string;
  value: string | number | undefined;
  status: "normal" | "warning" | "critical";
  tooltip?: string;
  icon?: React.ReactNode;
}

const SummaryCard = ({ metric, value, status, tooltip, icon }: SummaryCardProps) => {
  const statusConfig = {
    normal: {
      border: "border-l-blue-500",
      bg: "bg-white dark:bg-gray-800",
      iconBg: "bg-blue-50 dark:bg-blue-900/20",
      iconColor: "text-blue-500",
      shadow: "shadow-blue-500/5",
    },
    warning: {
      border: "border-l-amber-500",
      bg: "bg-amber-50/30 dark:bg-amber-900/10",
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      iconColor: "text-amber-500",
      shadow: "shadow-amber-500/10",
    },
    critical: {
      border: "border-l-red-500",
      bg: "bg-red-50/30 dark:bg-red-900/10",
      iconBg: "bg-red-100 dark:bg-red-900/30",
      iconColor: "text-red-500",
      shadow: "shadow-red-500/10",
    },
  };

  const config = statusConfig[status] || statusConfig.normal;

  return (
    <div
      className={`
        relative group transition-all duration-300
        ${config.bg} p-5 rounded-xl border-l-4 ${config.border} 
        shadow-sm ${config.shadow}
        hover:shadow-md hover:-translate-y-1 hover:border-l-8
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-x-2 mb-1">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {metric}
            </p>
            {tooltip && (
              <div className="relative group/tooltip">
                <MessageCircleQuestion
                  size={14}
                  className="text-gray-400 cursor-help hover:text-gray-600 transition-colors"
                />
                <div className="
                  absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                  invisible group-hover/tooltip:visible opacity-0 group-hover/tooltip:opacity-100
                  transition-all duration-200 transform scale-95 group-hover/tooltip:scale-100
                  bg-gray-900 dark:bg-gray-700 text-white text-[11px] leading-relaxed rounded-lg px-3 py-2
                  w-60 z-[60] shadow-xl border border-white/10
                ">
                  {tooltip}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                </div>
              </div>
            )}
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
            {value ?? "-"}
          </p>
        </div>
        
        {icon && (
          <div className={`p-2 rounded-lg ${config.iconBg} ${config.iconColor} transition-transform duration-300 group-hover:scale-110`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

export default SummaryCard;

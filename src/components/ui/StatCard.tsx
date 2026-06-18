interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color?: "indigo" | "green" | "yellow" | "red" | "purple";
}

const colorMap = {
  indigo: "from-indigo-500/20 to-indigo-500/5 text-indigo-400",
  green:  "from-green-500/20 to-green-500/5 text-green-400",
  yellow: "from-yellow-500/20 to-yellow-500/5 text-yellow-400",
  red:    "from-red-500/20 to-red-500/5 text-red-400",
  purple: "from-purple-500/20 to-purple-500/5 text-purple-400",
};

export default function StatCard({ label, value, sub, icon, color = "indigo" }: StatCardProps) {
  return (
    <div className="glass-card rounded-2xl p-5 hover:border-white/15 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="text-2xl font-bold mt-1 text-gray-100">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center bg-linear-to-br border border-white/5 ${colorMap[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

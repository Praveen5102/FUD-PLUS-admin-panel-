type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
}

const variantMap: Record<BadgeVariant, string> = {
  success: "bg-green-500/10 text-green-400 border border-green-500/20",
  warning: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
  danger:  "bg-red-500/10 text-red-400 border border-red-500/20",
  info:    "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
  neutral: "bg-gray-500/10 text-gray-400 border border-gray-500/20",
};

export default function Badge({ children, variant = "neutral" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${variantMap[variant]}`}>
      {children}
    </span>
  );
}

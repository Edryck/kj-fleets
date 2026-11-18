import RoleFigure from "../people/RoleFigure";

export default function Avatar({
    name,
    role,
    size = "md",
    className,
}: {
    name: string;
    role?: string | null;
    size?: "sm" | "md" | "lg";
    className?: string;
}) {
    return <RoleFigure role={role} name={name} size={size} className={className} />;
}

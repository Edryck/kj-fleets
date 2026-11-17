import { initials } from "./initials";

export default function Avatar({
    name,
    size = "md",
    className,
}: {
    name: string;
    size?: "sm" | "md" | "lg";
    className?: string;
}) {
    return (
        <span className={`avatar is-${size}${className ? ` ${className}` : ""}`} aria-hidden="true">
            {initials(name)}
        </span>
    );
}

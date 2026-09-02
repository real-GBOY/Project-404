/** @format */

import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
	/** leading Material Symbols icon */
	icon?: string;
	invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
	{ className, icon, invalid, ...props },
	ref,
) {
	return (
		<div
			className={cn(
				"flex h-9 items-center gap-2 rounded-md border bg-surface px-3 transition-colors focus-within:border-primary",
				invalid ? "border-danger" : "border-border-control",
				props.disabled && "opacity-50",
				className,
			)}
			data-slot='input'>
			{icon && <Icon name={icon} size={17} className='text-subtle' />}
			<input
				ref={ref}
				aria-invalid={invalid || undefined}
				className='w-full bg-transparent text-[13px] font-medium text-foreground outline-none placeholder:text-subtle disabled:cursor-not-allowed'
				{...props}
			/>
		</div>
	);
});

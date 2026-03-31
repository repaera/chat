import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
	return (
		<Suspense>
			<LoginForm emailEnabled={!!process.env.RESEND_API_KEY} />
		</Suspense>
	);
}

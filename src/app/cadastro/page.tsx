import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Criar conta · Gestor Financeiro" };

export default function Page() {
  return <AuthForm mode="cadastro" />;
}

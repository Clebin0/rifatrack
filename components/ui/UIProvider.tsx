"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Modal from "./Modal";
import Button from "./Button";
import Input from "./Input";
type Field = {
  key: string;
  label: string;
  value?: string;
  type?: string;
  required?: boolean;
};
type Answer = Record<string, string> | null;
type API = {
  confirm: (message: string) => Promise<boolean>;
  prompt: (label: string, value?: string) => Promise<string | null>;
  form: (title: string, fields: Field[]) => Promise<Answer>;
  toast: (message: string) => void;
};
const Context = createContext<API | null>(null);
export function useUI() {
  const value = useContext(Context);
  if (!value) throw new Error("UIProvider ausente");
  return value;
}
export default function UIProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<{ title: string; fields: Field[] } | null>(
    null,
  );
  const [notice, setNotice] = useState("");
  useEffect(() => {
    try {
      document.documentElement.classList.toggle(
        "theme-light",
        localStorage.getItem("rifatrack-theme") === "light",
      );
    } catch {}
  }, []);
  const resolve = useRef<((answer: Answer) => void) | null>(null);
  function finish(answer: Answer) {
    resolve.current?.(answer);
    resolve.current = null;
    setModal(null);
  }
  function form(title: string, fields: Field[]) {
    resolve.current?.(null);
    setModal({ title, fields });
    return new Promise<Answer>((done) => {
      resolve.current = done;
    });
  }
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 7000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(
    () => () => {
      resolve.current?.(null);
    },
    [],
  );
  return (
    <Context.Provider
      value={{
        form,
        confirm: async (message) => Boolean(await form(message, [])),
        prompt: async (label, value) =>
          (await form(label, [{ key: "value", label, value, required: true }]))
            ?.value ?? null,
        toast: setNotice,
      }}
    >
      {children}
      <Modal
        open={Boolean(modal)}
        title={modal?.title || "Confirmar ação"}
        onCancel={() => finish(null)}
      >
        <form
          key={modal?.title}
          onSubmit={(e) => {
            e.preventDefault();
            const values = new FormData(e.currentTarget);
            finish(
              Object.fromEntries(
                Array.from(values.entries()).map(([key, value]) => [
                  key,
                  String(value),
                ]),
              ),
            );
          }}
          className="space-y-4"
        >
          {modal?.fields.map((field) => (
            <Input
              key={field.key}
              name={field.key}
              label={field.label}
              type={field.type || "text"}
              defaultValue={field.value || ""}
              required={field.required}
              maxLength={200}
            />
          ))}
          <div className="flex justify-end gap-3 pt-3">
            <Button variant="secondary" onClick={() => finish(null)}>
              Cancelar
            </Button>
            <Button type="submit">Confirmar</Button>
          </div>
        </form>
      </Modal>
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed z-50 bottom-24 lg:bottom-6 right-4 left-4 sm:left-auto sm:max-w-md"
      >
        {notice && (
          <div className="ui-card flex items-start gap-4 shadow-xl">
            <p className="text-sm flex-1">{notice}</p>
            <button aria-label="Fechar aviso" onClick={() => setNotice("")}>
              ×
            </button>
          </div>
        )}
      </div>
    </Context.Provider>
  );
}

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const signInEmail = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth-client", () => ({ signIn: { email: signInEmail } }));

const { LoginForm } = await import("./login-form");

async function submit(email = "ashyan@studio.test", password = "correct-horse-battery") {
  const user = userEvent.setup();
  render(<LoginForm />);
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: /sign in/i }));
}

afterEach(() => window.history.replaceState(null, "", "/"));

describe("<LoginForm>", () => {
  it("signs in with the entered credentials and goes to /admin", async () => {
    signInEmail.mockResolvedValue({ error: null });
    await submit();
    expect(signInEmail).toHaveBeenCalledWith({
      email: "ashyan@studio.test",
      password: "correct-horse-battery",
      callbackURL: "/admin",
    });
  });

  it("returns to the admin page the user came from", async () => {
    window.history.replaceState(null, "", "/login?next=/admin/projects");
    signInEmail.mockResolvedValue({ error: null });
    await submit();
    expect(signInEmail).toHaveBeenCalledWith(
      expect.objectContaining({ callbackURL: "/admin/projects" }),
    );
  });

  it("ignores open-redirect attempts in ?next", async () => {
    window.history.replaceState(null, "", "/login?next=https://evil.example");
    signInEmail.mockResolvedValue({ error: null });
    await submit();
    expect(signInEmail).toHaveBeenCalledWith(expect.objectContaining({ callbackURL: "/admin" }));
  });

  it("shows the error and re-enables the button on failure", async () => {
    signInEmail.mockResolvedValue({ error: { message: "Invalid email or password" } });
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    await waitFor(() => expect(screen.getByRole("button", { name: /sign in/i })).toBeEnabled());
  });

  it("uses the right autocomplete hints for password managers", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "current-password");
  });
});

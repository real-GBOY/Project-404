import { render, screen } from "@testing-library/react-native";
import { Avatar, initials } from "./Avatar";

describe("initials", () => {
  it("takes first + last initial for a full name", () => {
    expect(initials("Mona Tawfik")).toBe("MT");
    expect(initials("  amira  saleh el-din ")).toBe("AE");
  });

  it("takes the first two letters of a single name", () => {
    expect(initials("Cher")).toBe("CH");
  });

  it("is empty for a blank name", () => {
    expect(initials("   ")).toBe("");
  });
});

describe("<Avatar />", () => {
  it("renders the computed initials", async () => {
    await render(<Avatar name="Mona Tawfik" />);
    expect(screen.getByText("MT")).toBeOnTheScreen();
  });
});

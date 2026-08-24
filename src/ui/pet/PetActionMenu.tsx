import type { RefObject } from "react";
import { Button } from "../design-system";

export type PetAction =
  | "feed"
  | "chat"
  | "status"
  | "hide"
  | "settings";

interface PetActionMenuProps {
  readonly affordanceVisible: boolean;
  readonly menuOpen: boolean;
  readonly overflowOpen: boolean;
  readonly affordanceRef: RefObject<HTMLButtonElement | null>;
  readonly menuRef: RefObject<HTMLDivElement | null>;
  readonly onAffordanceClick: () => void;
  readonly onAction: (action: PetAction) => void;
  readonly onOverflowToggle: () => void;
  readonly onActivity: () => void;
  readonly onPointerEnter: () => void;
  readonly onPointerLeave: () => void;
  readonly onAffordancePointerEnter: () => void;
  readonly onAffordancePointerLeave: () => void;
  readonly onFocus: () => void;
}

function BowlIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10h16c-.7 5-3.1 8-8 8s-7.3-3-8-8Z" />
      <path d="M7 7c1.2-1.7 2.9-2.5 5-2.5S15.8 5.3 17 7" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5.5h16v10H9l-5 3v-13Z" />
      <path d="M8 10h8M8 13h5" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  );
}

export function PetActionMenu({
  affordanceVisible,
  menuOpen,
  overflowOpen,
  affordanceRef,
  menuRef,
  onAffordanceClick,
  onAction,
  onOverflowToggle,
  onActivity,
  onPointerEnter,
  onPointerLeave,
  onAffordancePointerEnter,
  onAffordancePointerLeave,
  onFocus,
}: PetActionMenuProps) {
  return (
    <div
      className="pet-action-layer"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocus={onFocus}
      onPointerMove={onActivity}
    >
      {affordanceVisible || menuOpen ? (
        <button
          ref={affordanceRef}
          className={"pet-action-affordance" + (menuOpen ? " is-open" : "")}
          type="button"
          aria-label={menuOpen ? "收起操作菜单" : "打开操作菜单"}
          aria-expanded={menuOpen}
          onClick={(event) => {
            event.stopPropagation();
            onActivity();
            onAffordanceClick();
          }}
          onPointerEnter={onAffordancePointerEnter}
          onPointerLeave={onAffordancePointerLeave}
          onFocus={onFocus}
        >
          <MoreIcon />
        </button>
      ) : null}

      {menuOpen ? (
        <div
          ref={menuRef}
          className="pet-action-menu"
          role="menu"
          aria-label="女儿操作"
          onPointerEnter={onActivity}
          onFocus={onFocus}
        >
          <div className="pet-action-menu__primary">
            <Button
              className="pet-action-menu__button"
              variant="soft"
              type="button"
              role="menuitem"
              icon={<BowlIcon />}
              onClick={() => onAction("feed")}
            >
              喂饭
            </Button>
            <Button
              className="pet-action-menu__button"
              variant="soft"
              type="button"
              role="menuitem"
              icon={<ChatIcon />}
              onClick={() => onAction("chat")}
            >
              聊天
            </Button>
            <Button
              className="pet-action-menu__more"
              variant="quiet"
              type="button"
              role="menuitem"
              aria-label={overflowOpen ? "收起更多操作" : "更多操作"}
              aria-expanded={overflowOpen}
              onClick={() => {
                onActivity();
                onOverflowToggle();
              }}
            >
              <MoreIcon />
            </Button>
          </div>
          {overflowOpen ? (
            <div className="pet-action-menu__overflow" role="menu">
              <button type="button" role="menuitem" onClick={() => onAction("status")}>
                状态
              </button>
              <button type="button" role="menuitem" onClick={() => onAction("hide")}>
                隐藏女儿
              </button>
              <button type="button" role="menuitem" onClick={() => onAction("settings")}>
                设置
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getTourSteps, resolveTourScope, type TourPlacement } from "./guidedTourCatalog";

interface TourTargetState {
  rect: DOMRect;
}

interface TourReplayDetail {
  scope?: string;
}

const TOUR_REPLAY_EVENT = "fydor-guided-tour:replay";

export function createTourScope(route: string, tab?: string) {
  return tab ? `${route}::${tab}` : route;
}

export function GuidedTour() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mounted, setMounted] = useState(false);
  const [activeScope, setActiveScope] = useState<string | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [target, setTarget] = useState<TourTargetState | null>(null);

  const activeSteps = useMemo(() => {
    if (!activeScope) return null;
    return getTourSteps(activeScope);
  }, [activeScope]);

  const activeStep = useMemo(() => {
    if (!activeSteps) return null;
    return activeSteps[activeStepIndex] ?? null;
  }, [activeStepIndex, activeSteps]);

  useEffect(() => {
    setMounted(true);

    function handleReplayTour(event: Event) {
      const detail = (event as CustomEvent<TourReplayDetail>).detail;
      const scope = resolveTourScope(detail?.scope ?? pathname);
      if (!getTourSteps(scope)) return;

      setActiveScope(scope);
      setActiveStepIndex(0);
      setTarget(null);
    }

    window.addEventListener(TOUR_REPLAY_EVENT, handleReplayTour as EventListener);
    return () => window.removeEventListener(TOUR_REPLAY_EVENT, handleReplayTour as EventListener);
  }, [pathname]);

  useEffect(() => {
    if (!mounted || !activeStep) return;

    const selectors = activeStep.targetSelectors ?? [];
    if (!selectors.length) {
      setTarget(null);
      return;
    }

    let animationFrame = 0;
    let interval = 0;

    function updateTarget() {
      const resolved = findTarget(selectors);
      if (!resolved) {
        setTarget(null);
        return false;
      }

      setTarget({ rect: resolved.getBoundingClientRect() });
      if (interval) {
        window.clearInterval(interval);
        interval = 0;
      }
      return true;
    }

    animationFrame = window.requestAnimationFrame(() => {
      const found = updateTarget();
      if (!found) {
        interval = window.setInterval(updateTarget, 250);
      }
    });

    function handleViewportChange() {
      updateTarget();
    }

    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearInterval(interval);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [activeStep, mounted, pathname]);

  if (!mounted || !activeSteps || !activeStep) {
    return null;
  }

  const isOnStepRoute = pathname === activeStep.route;
  const panelStyle = buildPanelStyle(target?.rect, activeStep.placement ?? "bottom");
  const spotlightStyle = target ? buildSpotlightStyle(target.rect) : undefined;

  function closeTour() {
    setActiveScope(null);
    setActiveStepIndex(0);
    setTarget(null);
  }

  function goToStep(stepIndex: number) {
    if (stepIndex < 0) return;
    const steps = activeSteps;
    if (!steps) return;
    if (stepIndex >= steps.length) {
      closeTour();
      return;
    }

    const nextStep = steps[stepIndex];
    setActiveStepIndex(stepIndex);
    setTarget(null);
    if (pathname !== nextStep.route) {
      navigate(nextStep.route);
    }
  }

  return (
    <div className="guided-tour-layer" aria-hidden="false">
      <div className="guided-tour-backdrop" />
      {target ? <div className="guided-tour-spotlight" style={spotlightStyle} /> : null}
      <section className="guided-tour-panel card" style={panelStyle} role="dialog" aria-modal="true" aria-labelledby="guided-tour-title">
        <div className="guided-tour-meta">
          <span className="page-state-eyebrow">{activeStep.section}</span>
          <span className="guided-tour-step">{activeStepIndex + 1} of {activeSteps.length}</span>
        </div>
        <h1 id="guided-tour-title">{activeStep.title}</h1>
        <p className="muted">{activeStep.description}</p>
        {activeStep.details?.length ? (
          <ol className="guided-tour-detail-list">
            {activeStep.details.map((detail) => <li key={detail}>{detail}</li>)}
          </ol>
        ) : null}
        {!isOnStepRoute ? (
          <p className="guided-tour-note">You are on a different page, so this step will move you to the right screen.</p>
        ) : null}
        {!target && activeStep.targetSelectors?.length ? (
          <p className="guided-tour-note">I&apos;m waiting for the highlighted control to appear.</p>
        ) : null}
        {!activeStep.targetSelectors?.length ? (
          <p className="guided-tour-note">This step explains the current view without a spotlight target.</p>
        ) : null}
        <div className="page-state-actions guided-tour-actions">
          <button
            type="button"
            className="button secondary"
            disabled={activeStepIndex === 0}
            onClick={() => goToStep(activeStepIndex - 1)}
          >
            Back
          </button>
          <button type="button" className="button secondary" onClick={closeTour}>
            Skip tour
          </button>
          <button type="button" className="button" onClick={() => goToStep(activeStepIndex + 1)}>
            {activeStep.primaryLabel ?? "Next"}
          </button>
        </div>
      </section>
    </div>
  );
}

export function replayGuidedTour(scope?: string) {
  const resolvedScope = typeof window === "undefined"
    ? scope
    : resolveTourScope(scope ?? window.location.pathname);

  if (!resolvedScope || !getTourSteps(resolvedScope)) {
    return;
  }

  window.dispatchEvent(new CustomEvent<TourReplayDetail>(TOUR_REPLAY_EVENT, {
    detail: { scope: resolvedScope }
  }));
}

function findTarget(selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    const match = document.querySelector<HTMLElement>(selector);
    if (!match) continue;
    if (!isVisible(match)) continue;
    return match;
  }

  return null;
}

function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
}

function buildPanelStyle(rect: DOMRect | undefined, placement: TourPlacement): CSSProperties {
  const width = Math.min(420, typeof window !== "undefined" ? window.innerWidth - 24 : 420);
  const margin = 20;
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;
  const estimatedPanelHeight = Math.min(420, viewportHeight - margin * 2);
  const maxTop = Math.max(margin, viewportHeight - estimatedPanelHeight - margin);
  const clampTop = (value: number) => Math.max(margin, Math.min(value, maxTop));

  let left = margin;
  let top = maxTop;

  if (rect) {
    if (placement === "right") {
      left = Math.min(rect.right + margin, viewportWidth - width - margin);
      top = clampTop(rect.top - 8);
    } else if (placement === "top") {
      left = Math.max(margin, Math.min(rect.left, viewportWidth - width - margin));
      top = clampTop(rect.top - estimatedPanelHeight - margin);
    } else if (placement === "bottom") {
      left = Math.max(margin, Math.min(rect.left, viewportWidth - width - margin));
      top = clampTop(rect.bottom + margin);
    } else {
      left = Math.max(margin, rect.left - width - margin);
      top = clampTop(rect.top);
    }
  }

  return {
    left,
    top,
    width
  };
}

function buildSpotlightStyle(rect: DOMRect): CSSProperties {
  return {
    left: Math.max(8, rect.left - 10),
    top: Math.max(8, rect.top - 10),
    width: rect.width + 20,
    height: rect.height + 20
  };
}

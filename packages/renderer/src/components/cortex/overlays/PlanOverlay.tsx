import type { StreamPlanPayload } from '@cortex-ide/shared';

export function PlanOverlay({
  plan,
  onApprove,
  onReject,
}: {
  plan: StreamPlanPayload;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[1050] flex items-center justify-center bg-black/40" data-testid="plan-overlay">
      <div className="w-[520px] rounded-[10px] border border-border bg-elevated p-4">
        <div className="text-[12px] text-text-tertiary mb-1">Plan review</div>
        <h2 className="text-[16px] font-medium mb-2">{plan.title}</h2>
        <p className="text-[13px] text-text-secondary mb-3">{plan.rationale}</p>
        <ol className="space-y-1 mb-4">
          {plan.steps.map((step, index) => (
            <li key={step.id} className="text-[13px] flex gap-2">
              <span className="text-text-tertiary w-4">{index + 1}</span>
              <span>{step.title}</span>
            </li>
          ))}
        </ol>
        <div className="flex justify-end gap-2">
          <button type="button" className="h-8 px-3 rounded-md border border-border text-[13px]" onClick={onReject}>
            Reject
          </button>
          <button type="button" className="h-8 px-3 rounded-md bg-accent text-page text-[13px]" onClick={onApprove}>
            Approve plan
          </button>
        </div>
      </div>
    </div>
  );
}

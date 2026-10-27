window.__ModuleLoader__.load({
	id: "dsh-quick-prompts",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/shared.ts
		/** namespace 名（locale 注册与 configForms key 同名） */
		const QUICK_PROMPTS_NS = "dsh-quick-prompts";
		/** 数据面 route 前缀与落盘路径 */
		const DATA_ROUTE = "/api/dsh-quick-prompts/data";
		function parseListSortMode(value) {
			return value === "created" || value === "updated" ? value : "name";
		}
		[
			{
				name: "check",
				label: "谋定后动",
				body: "不要默认认同我的观点，也不要为了让我满意而附和我。\n回答前，先检查我的问题里是否存在错误前提、逻辑跳跃、信息缺失或未经证实的判断。如果有，请直接指出，不要沿着错误前提继续推导。\n请明确区分：已确认的事实、合理推测、个人观点和暂时无法验证的信息。涉及事实、数字、人物、日期、引用和案例时，尽可能核对来源；无法确认就直接说明，不要编造。\n当你不同意我的判断时，请清楚说明原因，并给出反例、风险或更合理的解释。不要只给结论，要说明推理过程。"
			},
			{
				name: "start",
				label: "开工确认",
				body: "先不要修改任何代码文件。针对这个复杂需求，先说明：1. 用你的话复述需求本质与最终验收标准；2. 列出本次改动涉及的最小文件清单；3. 明确说明你打算放弃/不碰哪部分逻辑（划清边界）；4. 潜在的破坏性改动（Breaking Change）与风险。等我确认"
			},
			{
				name: "restate",
				label: "需求复述",
				body: "先不要给我任何建议或方案。请用你自己的话重新复述一遍：\n1. 你认为我真正的核心目标是什么？\n2. 我当前试图解决的最底层的痛点是什么？\n3. 哪些是我明确在意的，哪些只是干扰情绪？"
			},
			{
				name: "example",
				label: "对比举例",
				body: "用当前项目里的真实数据举例输入输出，不要虚构的例子。\n如果前后有调整，按原样式各举一处改前、改后；\n考虑边界情况；有前后差异就都展示，先别改文件。"
			},
			{
				name: "wait",
				label: "等一等",
				body: "先分析 等我确认"
			},
			{
				name: "review",
				label: "收尾复盘",
				body: "回顾这次对话或当前项目，找出没做完、被遗漏或值得做的事，只列你建议做的。\n有没有一个更深、我一直绕开没问出口的问题或者未考虑到的高风险？\n如果有，引用原话依据并给优化方案\n如果证据不够就省略，不要编。"
			}
		].map((p) => ({ ...p }));
		//#endregion
		//#region src/client/settings-store.ts
		/** 0.2.0 Config 投影的 volatile ref：{ get(): T }；原始值（测试/直传）原样 */
		const unwrapVolatile = (v, fallback) => {
			if (v === void 0 || v === null) return fallback;
			if (typeof v === "object" && "get" in v) return v.get() ?? fallback;
			return v;
		};
		function createContextSettings() {
			let state = {
				status: "loading",
				prompts: [],
				sendBehavior: "send",
				usage: {},
				listSortMode: "name",
				writable: false
			};
			let bound = null;
			const listeners = /* @__PURE__ */ new Set();
			const publish = (next) => {
				state = next;
				for (const listener of listeners) listener();
			};
			/** prompts/usage 从数据面 route 拉取（host 落盘；失败 → unavailable，卡片不渲染） */
			const loadData = async () => {
				try {
					const data = await (await fetch(DATA_ROUTE, { method: "GET" })).json();
					publish({
						...state,
						status: "ready",
						prompts: Array.isArray(data.prompts) ? data.prompts : [],
						usage: data.usage && typeof data.usage === "object" ? data.usage : {},
						listSortMode: parseListSortMode(data.listSortMode)
					});
				} catch {
					publish({
						...state,
						status: "unavailable"
					});
				}
			};
			/** prompts/usage 变更后 POST 全量落盘（best-effort，失败不阻塞 UI） */
			const persist = (patch = {}) => {
				fetch(DATA_ROUTE, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						prompts: patch.prompts ?? state.prompts,
						usage: patch.usage ?? state.usage,
						listSortMode: patch.listSortMode ?? state.listSortMode
					})
				}).catch(() => {});
			};
			/** 从 Config 投影同步 sendBehavior（volatile ref 解包）+ writable */
			const syncFromConfig = (b) => {
				try {
					const snap = b.getSnapshot();
					const sendBehavior = unwrapVolatile(snap?.value?.sendBehavior, "send");
					const writable = Boolean(snap?.writable);
					if (sendBehavior !== state.sendBehavior || writable !== state.writable) publish({
						...state,
						sendBehavior,
						writable
					});
				} catch {}
			};
			return {
				store: {
					subscribe(listener) {
						listeners.add(listener);
						return () => {
							listeners.delete(listener);
						};
					},
					getSnapshot: () => state
				},
				set(field, value) {
					if (field === "sendBehavior") {
						const v = value === "fill" ? "fill" : "send";
						publish({
							...state,
							sendBehavior: v
						});
						bound?.set("sendBehavior", v);
						return;
					}
					if (field === "prompts" && Array.isArray(value)) {
						const prompts = value;
						publish({
							...state,
							prompts
						});
						persist({ prompts });
						return;
					}
					if (field === "usage" && value !== null && typeof value === "object") {
						const usage = value;
						publish({
							...state,
							usage
						});
						persist({ usage });
						return;
					}
					if (field === "listSortMode") {
						const listSortMode = parseListSortMode(value);
						if (listSortMode === state.listSortMode) return;
						publish({
							...state,
							listSortMode
						});
						persist({ listSortMode });
					}
				},
				attach(b) {
					if (!b) return () => {};
					bound = b;
					syncFromConfig(b);
					let unsubscribe;
					try {
						unsubscribe = b.subscribe(() => syncFromConfig(b));
					} catch {}
					loadData();
					return () => {
						unsubscribe?.();
						bound = null;
					};
				}
			};
		}
		//#endregion
		//#region src/client/styles.ts
		const CSS_TAG_ID = "dsh-quick-prompts/settings.css";
		const CSS = `
.qp-prefs { display: flex; flex-direction: column; gap: 16px; }
.qp-note { margin: 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary, #999)); }
.qp-block { display: flex; flex-direction: column; gap: 9px; }
.qp-block-title { font-size: 14px; font-weight: 600; letter-spacing: .02em; color: var(--dsw-alias-label-primary, inherit); }
.qp-select { align-self: flex-start; font-size: 13px; padding: 5px 8px; border-radius: 6px; border: 1px solid var(--dsw-alias-border-secondary, rgba(127,127,127,.3)); background: transparent; color: var(--dsw-alias-label-primary, inherit); min-width: 160px; }
.qp-select:disabled { opacity: .45; }
.qp-pref-desc { margin: 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary, #999)); }
.qp-list-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.qp-sort { min-width: 130px; }
.qp-cards { display: flex; flex-direction: column; gap: 10px; }
.qp-card { border: 1px solid var(--dsw-alias-border-secondary, rgba(127,127,127,.25)); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
.qp-card-head { display: flex; align-items: flex-start; gap: 8px; min-width: 0; }
.qp-badge { flex: none; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; padding: 1px 6px; border-radius: 5px; background: var(--dsw-alias-fill-secondary, rgba(127,127,127,.15)); color: var(--dsw-alias-label-primary, inherit); }
.qp-card-label { font-size: 13px; color: var(--dsw-alias-label-primary, inherit); white-space: nowrap; }
.qp-card-preview { font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary, #999)); overflow: hidden; white-space: normal; flex: 1; min-width: 0; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; cursor: pointer; }
.qp-card-preview.qp-open { display: block; -webkit-line-clamp: unset; line-clamp: unset; white-space: pre-wrap; overflow-wrap: anywhere; }
.qp-expand { flex: none; border: none; background: transparent; color: var(--dsw-alias-label-secondary, #999); cursor: pointer; font-size: 12px; padding: 0 2px; }
.qp-expand:hover { color: var(--dsw-alias-label-primary, inherit); }
.qp-card-actions { flex: none; display: flex; gap: 6px; }
.qp-icon { border: none; background: transparent; cursor: pointer; font-size: 12px; color: var(--dsw-alias-label-secondary, #999); padding: 2px 4px; border-radius: 4px; }
.qp-icon:hover:not(:disabled) { color: var(--dsw-alias-label-primary, inherit); background: var(--dsw-alias-fill-secondary, rgba(127,127,127,.15)); }
.qp-icon:disabled { opacity: .45; cursor: not-allowed; }
.qp-edit { display: flex; flex-direction: column; gap: 8px; }
.qp-field { display: flex; flex-direction: column; gap: 3px; font-size: 12px; color: var(--dsw-alias-label-secondary, #999); }
.qp-input, .qp-textarea { font-size: 13px; padding: 5px 8px; border-radius: 6px; border: 1px solid var(--dsw-alias-border-secondary, rgba(127,127,127,.3)); background: transparent; color: var(--dsw-alias-label-primary, inherit); }
.qp-input:disabled, .qp-textarea:disabled { opacity: .45; }
.qp-textarea { min-height: 56px; resize: vertical; font-family: inherit; }
.qp-edit-foot { display: flex; justify-content: flex-end; gap: 8px; }
.qp-btn { font-size: 12px; padding: 4px 12px; border-radius: 6px; border: 1px solid var(--dsw-alias-border-secondary, rgba(127,127,127,.3)); background: transparent; color: var(--dsw-alias-label-primary, inherit); cursor: pointer; }
.qp-btn:disabled { opacity: .45; cursor: not-allowed; }
.qp-primary { background: var(--dsw-alias-fill-primary, rgba(127,127,127,.2)); }
.qp-add { align-self: flex-start; font-size: 12px; padding: 4px 10px; border-radius: 6px; border: 1px dashed var(--dsw-alias-border-secondary, rgba(127,127,127,.4)); background: transparent; color: var(--dsw-alias-label-secondary, #999); cursor: pointer; }
.qp-add:hover:not(:disabled) { opacity: .8; color: var(--dsw-alias-label-primary, inherit); }
.qp-add:disabled { opacity: .45; cursor: not-allowed; }
.qp-usage { display: flex; flex-direction: column; gap: 10px; }
.qp-usage-body { display: flex; flex-direction: column; gap: 2px; }
.qp-usage-head { display: flex; justify-content: space-between; font-size: 12px; color: var(--dsw-alias-label-secondary, #999); }
.qp-usage-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 6px 0; }
.qp-usage-row.qp-zero { opacity: .45; }
.qp-u-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
.qp-u-badge { flex: none; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; padding: 1px 6px; border-radius: 5px; background: var(--dsw-alias-fill-secondary, rgba(127,127,127,.15)); color: var(--dsw-alias-label-primary, inherit); }
.qp-u-label { font-size: 13px; color: var(--dsw-alias-label-primary, inherit); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qp-u-right { display: flex; align-items: center; gap: 8px; flex: none; }
.qp-u-bar { width: 64px; height: 4px; border-radius: 2px; background: var(--dsw-alias-fill-secondary, rgba(127,127,127,.15)); overflow: hidden; }
.qp-u-bar i { display: block; height: 100%; background: var(--dsw-alias-label-secondary, #999); }
.qp-u-count { font-size: 12px; font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-secondary, #999); min-width: 20px; text-align: right; }
.qp-u-pct { font-size: 11px; color: var(--dsw-alias-label-tertiary, #999); min-width: 32px; text-align: right; }
.qp-usage-empty { font-size: 12px; color: var(--dsw-alias-label-tertiary, #999); }
`;
		/** 插件 CSS 一次性注入（materialize 时执行；重复 materialize 由 data-plugin-css 去重） */
		function injectStyles() {
			if (typeof document === "undefined") return;
			if (document.querySelector(`style[data-plugin-css="dsh-quick-prompts/settings.css"]`) !== null) return;
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-quick-prompts";
			tag.dataset.pluginCss = CSS_TAG_ID;
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region src/client/locales.ts
		const NS = "dsh-quick-prompts";
		const zh = {
			"nav": "快捷指令",
			"desc": "在输入框敲 /缩写 回车，把预设文本追加到草稿。",
			"list.title": "指令列表",
			"list.add": "+ 添加快捷指令",
			"list.sort.title": "排序方式",
			"list.sort.name": "按字母排序",
			"list.sort.created": "按添加时间排序",
			"list.sort.updated": "按修改时间排序",
			"list.expand": "展开",
			"list.collapse": "收起",
			"field.name": "缩写（/ 后触发词）",
			"field.name.ph": "如 check",
			"field.label": "显示名（选填，空则显示缩写）",
			"field.label.ph": "如 谋定后动",
			"field.body": "展开文本",
			"field.body.ph": "回车后追加到草稿的内容",
			"btn.save": "保存",
			"btn.cancel": "取消",
			"act.run": "模拟调用",
			"act.edit": "编辑",
			"act.del": "删除",
			"behavior.title": "回车行为",
			"behavior.send": "追加后发送",
			"behavior.fill": "追加到草稿",
			"behavior.send.hint": "选中快捷指令后，把展开文本填进草稿并立刻发送。触发词本身不会发出。",
			"behavior.fill.hint": "选中快捷指令后，把展开文本填进草稿（末尾带空格），不发送，方便接着改再发。",
			"usage.title": "使用统计",
			"usage.head": "调用次数分布",
			"usage.total": "共 {n} 次",
			"usage.empty": "还没有调用记录",
			"toast.saved": "已保存",
			"toast.deleted": "已删除",
			"toast.nameRequired": "缩写必填",
			"toast.bodyRequired": "展开文本必填",
			"toast.dup": "缩写 \"{name}\" 已存在",
			"toast.triggered": "/{name} 已触发",
			"readonly": "当前环境为只读，设置不可修改"
		};
		const en = {
			"nav": "Quick Prompts",
			"desc": "Type /alias + Enter in the composer to append the preset text to the draft.",
			"list.title": "Prompts",
			"list.add": "+ Add quick prompt",
			"list.sort.title": "Sort by",
			"list.sort.name": "Alphabetical",
			"list.sort.created": "Date added",
			"list.sort.updated": "Date modified",
			"list.expand": "Expand",
			"list.collapse": "Collapse",
			"field.name": "Alias (trigger after /)",
			"field.name.ph": "e.g. check",
			"field.label": "Label (optional, defaults to alias)",
			"field.label.ph": "e.g. Think first",
			"field.body": "Expand text",
			"field.body.ph": "Text appended to the draft on Enter",
			"btn.save": "Save",
			"btn.cancel": "Cancel",
			"act.run": "Simulate trigger",
			"act.edit": "Edit",
			"act.del": "Delete",
			"behavior.title": "Enter behavior",
			"behavior.send": "Append & send",
			"behavior.fill": "Append to draft",
			"behavior.send.hint": "On pick, fill the expand text into the draft and send it immediately. The /alias is not sent.",
			"behavior.fill.hint": "On pick, fill the expand text into the draft (trailing space) and wait for you to edit and send.",
			"usage.title": "Usage stats",
			"usage.head": "Call distribution",
			"usage.total": "{n} total",
			"usage.empty": "No calls yet",
			"toast.saved": "Saved",
			"toast.deleted": "Deleted",
			"toast.nameRequired": "Alias is required",
			"toast.bodyRequired": "Expand text is required",
			"toast.dup": "Alias \"{name}\" already exists",
			"toast.triggered": "/{name} triggered",
			"readonly": "Read-only view"
		};
		//#endregion
		//#region src/client/prompt-data.ts
		/** 按原数组下标删除一条指令，并返回删除对象的 usage 副本。 */
		function deletePrompt(prompts, usage, index) {
			const next = prompts.slice();
			const name = next[index].name;
			next.splice(index, 1);
			const nextUsage = { ...usage };
			delete nextUsage[name];
			return {
				prompts: next,
				usage: nextUsage,
				name
			};
		}
		/** 新增或修改一条指令；仅实质变化刷新修改时间，不更改原数组。 */
		function savePrompt(prompts, draft, index, now) {
			const next = prompts.slice();
			const name = draft.name.trim();
			if (index >= next.length) {
				next.push({
					name,
					label: draft.label,
					body: draft.body,
					createdAt: now,
					updatedAt: now
				});
				return next;
			}
			const original = next[index];
			if (name !== original.name || draft.label !== original.label || draft.body !== original.body) next[index] = {
				...original,
				name,
				label: draft.label,
				body: draft.body,
				updatedAt: now
			};
			return next;
		}
		//#endregion
		//#region src/client/sort.ts
		/** 只排序视图：保留原下标，供编辑、删除精确定位。 */
		function sortPrompts(prompts, mode) {
			return prompts.map((prompt, index) => ({
				prompt,
				index
			})).sort((a, b) => {
				if (mode === "name") return a.prompt.name.toLowerCase().localeCompare(b.prompt.name.toLowerCase(), "en") || a.prompt.name.localeCompare(b.prompt.name, "en") || a.index - b.index;
				const field = mode === "created" ? "createdAt" : "updatedAt";
				const aTime = a.prompt[field];
				const bTime = b.prompt[field];
				if (aTime && !bTime) return -1;
				if (!aTime && bTime) return 1;
				if (aTime && bTime && aTime !== bTime) return bTime.localeCompare(aTime);
				return a.index - b.index;
			});
		}
		//#endregion
		//#region src/client/UsagePanel.tsx
		const UsagePanel = ({ prompts, usage, t }) => {
			const rows = prompts.map((p) => ({
				p,
				n: usage[p.name] ?? 0
			}));
			const total = rows.reduce((s, r) => s + r.n, 0);
			rows.sort((a, b) => b.n - a.n);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "qp-usage",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "qp-usage-head",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "qp-usage-t",
						children: t("usage.head")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "qp-usage-total",
						children: t("usage.total", { n: total })
					})]
				}), total === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "qp-usage-empty",
					children: t("usage.empty")
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "qp-usage-body",
					children: rows.map(({ p, n }) => {
						const pct = total ? Math.round(n / total * 100) : 0;
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: `qp-usage-row${n === 0 ? " qp-zero" : ""}`,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "qp-u-left",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "qp-u-badge",
									children: p.name
								}), p.label ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "qp-u-label",
									children: p.label
								}) : null]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "qp-u-right",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "qp-u-bar",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", { style: { width: `${pct}%` } })
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "qp-u-count",
										children: n
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "qp-u-pct",
										children: [pct, "%"]
									})
								]
							})]
						}, p.name);
					})
				})]
			});
		};
		//#endregion
		//#region src/client/QuickSettingsCard.tsx
		const empty = () => ({
			name: "",
			label: "",
			body: ""
		});
		const QuickSettingsCard = ({ useContextSettings, set, t }) => {
			const [editing, setEditing] = (0, react.useState)(null);
			const [draft, setDraft] = (0, react.useState)(empty());
			const [expanded, setExpanded] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			const toggleExpanded = (name) => setExpanded((previous) => {
				const next = new Set(previous);
				if (next.has(name)) next.delete(name);
				else next.add(name);
				return next;
			});
			const state = typeof useContextSettings === "function" ? useContextSettings((s) => s) : void 0;
			if (state === void 0 || state.status === "unavailable") return null;
			const disabled = state.status !== "ready" || !state.writable;
			const prompts = state.prompts;
			const sortMode = state.listSortMode;
			const adding = editing === prompts.length;
			const beginAdd = () => {
				setDraft(empty());
				setEditing(prompts.length);
			};
			const beginEdit = (i) => {
				setDraft({ ...prompts[i] });
				setEditing(i);
			};
			const save = () => {
				if (!draft.name.trim()) {
					alert(t("toast.nameRequired"));
					return;
				}
				if (!draft.body.trim()) {
					alert(t("toast.bodyRequired"));
					return;
				}
				const idx = editing ?? prompts.length;
				if (prompts.findIndex((p, i) => p.name === draft.name.trim() && i !== idx) >= 0) {
					alert(t("toast.dup", { name: draft.name.trim() }));
					return;
				}
				const next = savePrompt(prompts, draft, idx, (/* @__PURE__ */ new Date()).toISOString());
				if (idx < prompts.length && next[idx].name !== prompts[idx].name) {
					const u = { ...state.usage };
					u[next[idx].name] = u[prompts[idx].name] ?? 0;
					delete u[prompts[idx].name];
					set("usage", u);
				}
				set("prompts", next);
				setEditing(null);
				alert(t("toast.saved"));
			};
			const del = (i) => {
				const removed = deletePrompt(prompts, state.usage, i);
				set("prompts", removed.prompts);
				set("usage", removed.usage);
				if (editing === i) setEditing(null);
				else if (editing !== null && editing > i) setEditing(editing - 1);
				alert(t("toast.deleted"));
			};
			const editor = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "qp-edit",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "qp-field-row",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: "qp-field",
							children: [t("field.name"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "qp-input",
								value: draft.name,
								onChange: (e) => setDraft({
									...draft,
									name: e.target.value
								}),
								placeholder: t("field.name.ph")
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: "qp-field",
							children: [t("field.label"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "qp-input",
								value: draft.label,
								onChange: (e) => setDraft({
									...draft,
									label: e.target.value
								}),
								placeholder: t("field.label.ph")
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: "qp-field",
						children: [t("field.body"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
							className: "qp-textarea",
							value: draft.body,
							onChange: (e) => setDraft({
								...draft,
								body: e.target.value
							}),
							placeholder: t("field.body.ph")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "qp-edit-foot",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "qp-btn",
							onClick: () => setEditing(null),
							children: t("btn.cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "qp-btn qp-primary",
							onClick: save,
							children: t("btn.save")
						})]
					})
				]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "qp-prefs",
				children: [
					state.status === "ready" && !state.writable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "qp-note",
						role: "status",
						children: t("readonly")
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "qp-block",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "qp-block-title",
								children: t("behavior.title")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								className: "qp-select",
								disabled,
								value: state.sendBehavior,
								"aria-label": t("behavior.title"),
								onChange: (e) => set("sendBehavior", e.target.value === "fill" ? "fill" : "send"),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "send",
									children: t("behavior.send")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "fill",
									children: t("behavior.fill")
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "qp-pref-desc",
								children: t(state.sendBehavior === "send" ? "behavior.send.hint" : "behavior.fill.hint")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "qp-block",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "qp-list-top",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "qp-block-title",
									children: t("list.title")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
									className: "qp-select qp-sort",
									disabled,
									value: sortMode,
									"aria-label": t("list.sort.title"),
									onChange: (e) => set("listSortMode", e.target.value),
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "name",
											children: t("list.sort.name")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "created",
											children: t("list.sort.created")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "updated",
											children: t("list.sort.updated")
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "qp-cards",
								children: [sortPrompts(prompts, sortMode).map(({ prompt: p, index: i }) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "qp-card",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "qp-card-head",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "qp-badge",
												children: p.name
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "qp-card-label",
												children: p.label || p.name
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: `qp-card-preview${expanded.has(p.name) ? " qp-open" : ""}`,
												title: p.body,
												onClick: () => toggleExpanded(p.name),
												children: p.body
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "qp-expand",
												onClick: () => toggleExpanded(p.name),
												"aria-expanded": expanded.has(p.name),
												children: t(expanded.has(p.name) ? "list.collapse" : "list.expand")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: "qp-card-actions",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "qp-icon",
													disabled,
													onClick: () => editing === i ? setEditing(null) : beginEdit(i),
													title: t("act.edit"),
													children: "✎"
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "qp-icon",
													disabled,
													onClick: () => del(i),
													title: t("act.del"),
													children: "✕"
												})]
											})
										]
									}), editing === i ? editor : null]
								}, p.name)), adding ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "qp-card",
									children: editor
								}) : null]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "qp-add",
								disabled: disabled || adding,
								onClick: beginAdd,
								children: t("list.add")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "qp-block",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "qp-block-title",
							children: t("usage.title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsagePanel, {
							prompts,
							usage: state.usage,
							t
						})]
					})
				]
			});
		};
		//#endregion
		//#region src/client/expand.ts
		/**
		* 把 prompt.body 追加到当前草稿末尾：
		* - 消费后草稿 trimEnd 为空 → 直接用 body
		* - 非空 → 剩余草稿 + '\n' + body（trimEnd 去掉消费 token 残留的尾部空格）
		*/
		function appendBody(draft, body) {
			const rest = draft.trimEnd();
			return rest === "" ? body : `${rest}\n${body}`;
		}
		/** fill：展开文本末尾补一个空格，方便接着打字；send：原文 */
		function expandText(body, sendBehavior) {
			return sendBehavior === "fill" ? `${body} ` : body;
		}
		//#endregion
		//#region src/client/quick-source.ts
		/** 关键词过滤纯函数：空 query 全显；否则 name/label 大小写不敏感子串命中才保留 */
		function filterPromptsByQuery(prompts, query) {
			const q = query.trim().toLowerCase();
			if (q === "") return [...prompts];
			return prompts.filter((p) => p.name.toLowerCase().includes(q) || p.label !== "" && p.label.toLowerCase().includes(q));
		}
		/** 候选固定按缩写排序，不改变持久化数组 */
		function sortPromptsByName(prompts) {
			return [...prompts].sort((a, b) => {
				return a.name.toLowerCase().localeCompare(b.name.toLowerCase(), "en") || a.name.localeCompare(b.name, "en");
			});
		}
		/** 根据 name 查 prompt */
		function findPrompt(prompts, name) {
			return prompts.find((p) => p.name === name);
		}
		/** 菜单行：name 仍是缩写（onPick 查找键）；description = 显示名 + 展开文本；section 作分组标题 */
		function toCandidate(p, section) {
			const description = p.label !== "" ? `${p.label} · ${p.body}` : p.body;
			return {
				name: p.name,
				description,
				section
			};
		}
		/**
		* matchEnter 只认整行就是 `/缩写`（无空白）。
		* 内核 bare-token 要求 draft.trim() === token，故 token 必须带 `/`。
		* 带前文的草稿不走这条路径，由菜单 onPick 的 span guard 消费。
		*/
		function parseBareSlashToken(line) {
			const trimmed = line.trim();
			if (!trimmed.startsWith("/")) return void 0;
			if (trimmed.search(/\s/) !== -1) return void 0;
			const name = trimmed.slice(1);
			if (name === "") return void 0;
			return {
				name,
				token: trimmed
			};
		}
		/**
		* 注册独立 / source。candidates 返回 prompts 行。
		* 菜单选中：返回 {text: body}，由内核 insert-text 按 span 替换 `/tt`。
		* 整行 /aim 回车：consume-token 清空后再 setDraft(body)。
		* sendBehavior=send 时等替换完成、phase 回到 plain 再 submit；fill 只填草稿。
		*/
		function registerQuickSource(deps) {
			const { ctx, store, sectionTitle } = deps;
			const inputTriggers = ctx.get("inputTriggers");
			if (inputTriggers === void 0) throw new Error("quick-prompts: inputTriggers unavailable");
			const resolveInput = (session) => {
				const actx = ctx.get("sessions")?.scope?.(session.sessionId);
				if (actx === void 0) throw new Error(`quick-prompts: session scope unavailable (${session.sessionId})`);
				const input = ctx.get("conversation")?.input?.for(actx);
				if (input === void 0) throw new Error("quick-prompts: conversation input unavailable");
				return {
					actx,
					input
				};
			};
			/**
			* 内核 insert-text / consume 完成后才计数；send 还要等 phase 回到 plain。
			* matchEnter 期间嵌套 submit 会被 adjudicating 吞掉；onPick 里同步 submit 会把尚未替换的 `/tt` 发出去。
			*/
			const afterReplace = (session, prompt, send) => {
				window.setTimeout(() => {
					try {
						const { input } = resolveInput(session);
						if (!input.state.getSnapshot().draft.includes(prompt.body)) return;
						const snap = store.getSnapshot();
						store.set("usage", {
							...snap.usage,
							[prompt.name]: (snap.usage[prompt.name] ?? 0) + 1
						});
						if (send) input.submit();
					} catch {
						return;
					}
				}, 0);
			};
			const source = {
				trigger: "/",
				name: "quick-prompts",
				candidates: (session, req) => {
					const matched = sortPromptsByName(filterPromptsByQuery(store.getSnapshot().prompts, req.query));
					return Promise.resolve(matched.map((p) => toCandidate(p, sectionTitle)));
				},
				onPick: (pick) => {
					const snap = store.getSnapshot();
					const prompt = findPrompt(snap.prompts, pick.candidate.name);
					if (prompt === void 0) return "handled";
					afterReplace(pick.session, prompt, snap.sendBehavior === "send");
					return { text: expandText(prompt.body, snap.sendBehavior) };
				},
				matchEnter: async (session, line) => {
					const parsed = parseBareSlashToken(line);
					if (parsed === void 0) return void 0;
					const snap = store.getSnapshot();
					const prompt = findPrompt(snap.prompts, parsed.name);
					if (prompt === void 0) return void 0;
					try {
						const { actx, input } = resolveInput(session);
						if (actx.bail("slash/input-consume-token", { guard: {
							kind: "bare-token",
							token: parsed.token
						} }) !== true) return "handled";
						input.setDraft(appendBody(input.state.getSnapshot().draft, expandText(prompt.body, snap.sendBehavior)));
						afterReplace(session, prompt, snap.sendBehavior === "send");
					} catch {
						return "handled";
					}
					return "handled";
				},
				warm: () => {}
			};
			return ctx.effect(() => inputTriggers.registerSource(source), "quick-prompts: slash source");
		}
		//#endregion
		//#region src/client/index.ts
		const inject = [
			"slots",
			"locale",
			"configForms",
			"inputTriggers"
		];
		function apply(ctx) {
			injectStyles();
			ctx.effect?.(() => ctx.locale?.register(NS, {
				zh,
				en
			}), "quick-prompts: dictionaries");
			const t = ctx.locale?.bind?.("dsh-quick-prompts") ?? ((key) => zh[key] ?? key);
			const settings = createContextSettings();
			const face = () => ({
				hooks: { contextSettings: settings.store },
				t,
				set: (field, value) => settings.set(field, value)
			});
			ctx.inject?.(["configForms"], (raw) => {
				const forms = raw.configForms;
				if (forms === void 0 || typeof forms.get !== "function" || typeof forms.whileServed !== "function") return;
				raw.effect?.(() => settings.attach(forms.get(QUICK_PROMPTS_NS)), "quick-prompts: config forms");
				raw.effect?.(() => forms.whileServed([QUICK_PROMPTS_NS], () => {
					return raw.slots.inject("plugins.bundle.config", () => raw.slots.register({
						name: "plugins.bundle.config",
						key: QUICK_PROMPTS_NS,
						locale: NS,
						inject: face
					}, (props) => (0, react.createElement)(QuickSettingsCard, props)));
				}), "quick-prompts: plugins-page card");
			});
			ctx.effect?.(() => registerQuickSource({
				ctx,
				store: {
					getSnapshot: settings.store.getSnapshot,
					set: settings.set
				},
				sectionTitle: t("nav")
			}), "quick-prompts: source registration");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
// ---------------------------
// window.BQ namespace
// ---------------------------
// Consolidates all public globals under a single namespace.
// Inline page scripts use BQ.* instead of window.GrasprToast, window.openFormModal, etc.

import {
    getRouteParams,
    populateSelect,
    escapeHtml,
    GrasprToast,
    openGlobalModal,
    closeGlobalModal,
    isGlobalModalOpen,
    GrasprConfirm,
    openFormModal,
    createBurst,
    attachClickBurst,
    initClickBurst,
    createTypeahead,
    apiFetch,
    onAfterSwap,
    onAfterSettle,
    onPageLoad,
    onHistoryRestore,
} from '@phillipsharring/graspr-framework';
import { capture as abCapture, getAssignments as abGetAssignments } from './ab.js';

import { GameAnnouncer } from './binder-quest/game-announcer.js';
import { EFFECT_TYPES, TRIGGER_TYPES, REWARD_TRIGGER_TYPES, populateSelect as designPopulateSelect } from './binder-quest/constants/design.js';
import * as SeriesStatuses from './binder-quest/constants/series-statuses.js';
import * as CollectionStatuses from './binder-quest/constants/collection-statuses.js';
import { CONDITION_TYPES, COMPARISON_OPERATORS } from './binder-quest/constants/story-mode.js';
import { ConditionBuilder } from './binder-quest/condition-builder.js';
import { EffectsBuilder } from './binder-quest/effects-builder.js';

import { GrasprPackOpener } from './binder-quest/pack-opener.js';

window.BQ = {
    // Lifecycle hooks
    hooks: { onAfterSwap, onAfterSettle, onPageLoad, onHistoryRestore },

    // API client
    api: { fetch: apiFetch },

    // Shared utilities
    getRouteParams,
    populateSelect,
    escapeHtml,

    // UI widgets
    ui: {
        toast: GrasprToast,
        modal: {
            open: openGlobalModal,
            close: closeGlobalModal,
            isOpen: isGlobalModalOpen,
        },
        confirm: GrasprConfirm,
        openFormModal,
        clickBurst: {
            create: createBurst,
            attach: attachClickBurst,
            init: initClickBurst,
        },
        createTypeahead,
    },

    // A/B testing
    ab: { capture: abCapture, getAssignments: abGetAssignments },

    // Game-specific
    game: {
        announcer: GameAnnouncer,
        packOpener: GrasprPackOpener,
    },

    // Admin-specific
    admin: {
        designConstants: { EFFECT_TYPES, TRIGGER_TYPES, REWARD_TRIGGER_TYPES, SeriesStatuses, CollectionStatuses, populateSelect: designPopulateSelect },
        storyConstants: { CONDITION_TYPES, COMPARISON_OPERATORS },
        conditionBuilder: ConditionBuilder,
        effectsBuilder: EffectsBuilder,
    },
};

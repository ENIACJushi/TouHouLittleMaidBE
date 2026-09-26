import {
  Entity,
  EntityDamageCause,
  EntityHurtBeforeEvent,
  Player,
  system,
} from "@minecraft/server";
import { Owner } from "./Owner";
import { Level } from "./Level";
import { Work } from "./Work";
import { MainMenu } from "../ui/MaidUI";

/**
 * 伤害管线上下文：before-hurt 单次回调内只读快照。
 * 使用场景：等级 / 护甲 / 饰品等 DamageModifier 计算最终承伤。
 */
export type DamageContext = {
  maid: Entity;
  /** 造成伤害的实体（若有） */
  source: Entity | undefined;
  cause: EntityDamageCause;
  /** 进入管线前的原始伤害值 */
  rawDamage: number;
};

/**
 * 承伤修正器：按注册顺序依次作用，约定顺序为 等级 → 护甲 → 饰品。
 * 使用场景：Task5 内置等级减伤；后续护甲/饰品任务 registerModifier 接入。
 */
export type DamageModifier = {
  id: string;
  apply: (ctx: DamageContext, damage: number) => number;
};

const MAID_TYPE_ID = "thlmm:maid";

/** 已注册修正器（含内置 level） */
const modifiers: DamageModifier[] = [];

let levelModifierRegistered = false;

/**
 * 注册承伤修正器。同 id 重复注册会替换旧项并保持相对顺序。
 * 使用场景：护甲 / 饰品系统在初始化时挂上乘区。
 */
export function registerDamageModifier(modifier: DamageModifier): void {
  const idx = modifiers.findIndex((m) => m.id === modifier.id);
  if (idx >= 0) {
    modifiers[idx] = modifier;
    return;
  }
  modifiers.push(modifier);
}

/**
 * 确保内置「等级减伤」修正器已注册（id=`level`）。
 * 使用场景：Damage 模块首次处理受伤前调用。
 */
function ensureLevelModifier(): void {
  if (levelModifierRegistered) {
    return;
  }
  levelModifierRegistered = true;
  registerDamageModifier({
    id: "level",
    apply: (ctx, damage) => {
      const taken = Level.getProperty(ctx.maid, "damageTaken") as number;
      if (typeof taken !== "number" || !Number.isFinite(taken)) {
        return damage;
      }
      return damage * taken;
    },
  });
}

/**
 * 是否为该女仆的主人（对齐 Owner DP / 名称，而非仅 JSON is_owner）。
 * 使用场景：主人免疫与潜行开菜单判定。
 */
function isOwnerOf(maid: Entity, maybeOwner: Entity | undefined): boolean {
  if (maybeOwner === undefined || maybeOwner.typeId !== "minecraft:player") {
    return false;
  }
  const ownerId = Owner.getID(maid);
  if (ownerId !== undefined && ownerId === maybeOwner.id) {
    return true;
  }
  const owner = Owner.get(maid);
  return owner !== undefined && owner.id === maybeOwner.id;
}

/**
 * 驯服女仆承伤：主人免疫 / 潜行开菜单 / 等级与其它 modifier 减伤。
 * 使用场景：替代 JSON `thlmm:lv*_tame` damage_sensor；由 EntityEvents 订阅 beforeHurt。
 */
export const Damage = {
  /**
   * beforeEvents.entityHurt 入口。野生女仆不拦截；已驯服则应用规则。
   */
  onBeforeHurt(event: EntityHurtBeforeEvent): void {
    const maid = event.hurtEntity;
    try {
      if (!maid.isValid || maid.typeId !== MAID_TYPE_ID) {
        return;
      }
    } catch {
      return;
    }

    // 野生：保持引擎默认承伤
    if (maid.getComponent("minecraft:is_tamed") === undefined) {
      return;
    }

    // NPC(-1) / 雕塑(-2) / 手办等 work<0：承伤仍由 JSON damage_sensor 处理，脚本不介入
    const work = Work.get(maid);
    if (typeof work === "number" && work < 0) {
      return;
    }

    const source = event.damageSource.damagingEntity;
    const cause = event.damageSource.cause;
    const rawDamage = event.damage;

    // 主人潜行近战：免伤并开菜单（对齐原 damage_sensor + thlmm:m）
    if (
      cause === EntityDamageCause.entityAttack &&
      isOwnerOf(maid, source) &&
      source !== undefined &&
      (source as Player).isSneaking === true
    ) {
      event.cancel = true;
      const player = source as Player;
      system.run(() => {
        try {
          if (!maid.isValid || !player.isValid) {
            return;
          }
          MainMenu(player, maid);
        } catch {
          // 实体可能已卸载或 UI 失败
        }
      });
      return;
    }

    // 主人其它伤害：免疫
    if (isOwnerOf(maid, source)) {
      event.cancel = true;
      return;
    }

    // 减伤管线：等级 →（预留）护甲 →（预留）饰品 → clamp≥0
    ensureLevelModifier();
    const ctx: DamageContext = {
      maid,
      source,
      cause,
      rawDamage,
    };
    let damage = rawDamage;
    for (const mod of modifiers) {
      damage = mod.apply(ctx, damage);
    }
    if (damage < 0) {
      damage = 0;
    }
    event.damage = damage;
  },

  /** 测试/调试：当前已注册修正器 id 列表 */
  listModifierIds(): string[] {
    ensureLevelModifier();
    return modifiers.map((m) => m.id);
  },

  /**
   * 注册承伤修正器（转发 registerDamageModifier）。
   * 使用场景：护甲/饰品初始化；顺序约定见模块头注释。
   */
  registerModifier: registerDamageModifier,
};

export { registerDamageModifier as registerModifier };

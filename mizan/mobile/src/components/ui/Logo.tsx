import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { colors } from "@/theme/tokens";
import { fontFamily } from "@/theme/typography";
import { useDir } from "@/lib/i18n/use-dir";

/**
 * The Mizan mark — a balance scale (`Mizan Identity.dc.html` §01). The beam
 * sits on the upper third; both pans hang at equal depth and radius; the
 * brass pivot dot is the only filled element in the system.
 *
 * Minimum-size rules from the identity: below 28px the base plate + pivot
 * drop away; below 18px only the beam and pans remain.
 */
export function Logo({
  size = 40,
  tone = "ink",
}: {
  size?: number;
  /** "ink" = Court Navy on paper · "reversed" = Paper on navy */
  tone?: "ink" | "reversed";
}) {
  const stroke = tone === "reversed" ? colors.textOnDark : colors.brandDark;
  const showBase = size >= 28;
  const showPivot = size >= 18;
  // stroke scales up as the mark shrinks (matches the identity's small marks)
  const sw = size >= 44 ? 3.6 : size >= 28 ? 4 : size >= 18 ? 6 : 8;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Path d="M50 26 V 78" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      {showBase ? (
        <Path d="M36 81 H 64" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      ) : null}
      <Path
        d={showBase ? "M16 32 H 84" : "M16 34 H 84"}
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="round"
      />
      <Path d="M16 32 V 42" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <Path d="M84 32 V 42" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <Circle
        cx={16}
        cy={showBase ? 53 : 56}
        r={showBase ? 11 : 12}
        stroke={stroke}
        strokeWidth={sw}
      />
      <Circle
        cx={84}
        cy={showBase ? 53 : 56}
        r={showBase ? 11 : 12}
        stroke={stroke}
        strokeWidth={sw}
      />
      {showPivot && showBase ? <Circle cx={50} cy={22} r={4.5} fill={colors.brandBronze} /> : null}
    </Svg>
  );
}

/**
 * The horizontal lockup — mark + "Mizan" (Spectral). In an RTL/Arabic context
 * the Arabic wordmark (Amiri) is used and the mark trails (§02 "Arabic —
 * mirrored, mark trails"); `flexDirection: row` under RTL already reverses it.
 */
export function Wordmark({
  markSize = 26,
  fontSize = 22,
  tone = "ink",
}: {
  markSize?: number;
  fontSize?: number;
  tone?: "ink" | "reversed";
}) {
  const { isRtl } = useDir();
  const color = tone === "reversed" ? colors.textOnDark : colors.brandDark;
  return (
    <View style={styles.lockup}>
      <Logo size={markSize} tone={tone} />
      <Text
        style={[
          isRtl
            ? { fontFamily: fontFamily.wordmark, fontSize: fontSize * 1.15 }
            : { fontFamily: fontFamily.display, fontSize, letterSpacing: 0.4 },
          { color },
        ]}
      >
        {isRtl ? "ميزان" : "Mizan"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: { flexDirection: "row", alignItems: "center", gap: 12 },
});

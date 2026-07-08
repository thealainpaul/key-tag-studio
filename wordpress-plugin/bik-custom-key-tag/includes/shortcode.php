<?php
/**
 * Shortcode: embed Key Tag Studio designer iframe.
 *
 * @package BIK_Custom_Key_Tag
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Detect storefront language for the studio (en, de, fr, it).
 *
 * @return string
 */
function bik_ckt_detect_language() {
	$supported = array( 'en', 'de', 'fr', 'it' );
	$lang      = '';

	// WPML.
	if ( defined( 'ICL_LANGUAGE_CODE' ) && ICL_LANGUAGE_CODE ) {
		$lang = strtolower( substr( (string) ICL_LANGUAGE_CODE, 0, 2 ) );
	}

	// Polylang.
	if ( '' === $lang && function_exists( 'pll_current_language' ) ) {
		$pll = pll_current_language( 'slug' );
		if ( is_string( $pll ) && '' !== $pll ) {
			$lang = strtolower( substr( $pll, 0, 2 ) );
		}
	}

	// WordPress locale fallback.
	if ( '' === $lang ) {
		$locale = determine_locale();
		$lang   = strtolower( substr( (string) $locale, 0, 2 ) );
	}

	if ( ! in_array( $lang, $supported, true ) ) {
		// Default German for BIK CH storefront; English otherwise.
		$lang = 'de';
	}

	return $lang;
}

/**
 * Build cart return base URL for the studio redirect after design.
 *
 * Studio should append design id, e.g. {cart_return}?bik_ckt_design={id}
 * or call REST /wp-json/bik-ckt/v1/add-to-cart?design_id={id}
 *
 * @return string
 */
function bik_ckt_cart_return_base() {
	return home_url( '/' );
}

/**
 * Shortcode callback.
 *
 * Usage: [bik_custom_key_tag_designer]
 *
 * @param array|string $atts Attributes.
 * @return string
 */
function bik_ckt_shortcode_designer( $atts = array() ) {
	$atts = shortcode_atts(
		array(
			'height' => '900',
		),
		$atts,
		'bik_custom_key_tag_designer'
	);

	$studio = untrailingslashit( (string) bik_ckt_get_option( 'studio_base_url' ) );
	if ( '' === $studio ) {
		if ( current_user_can( 'manage_woocommerce' ) ) {
			return '<p>' . esc_html__( 'BIK Custom Key Tag: configure Studio base URL in WooCommerce → BIK Custom Key Tag.', 'bik-custom-key-tag' ) . '</p>';
		}
		return '';
	}

	$lang        = bik_ckt_detect_language();
	$cart_return = bik_ckt_cart_return_base();
	$src         = add_query_arg(
		array(
			'lang'        => $lang,
			'embed'       => '1',
			'cart_return' => $cart_return,
		),
		$studio . '/'
	);

	$height = absint( $atts['height'] );
	if ( $height < 400 ) {
		$height = 900;
	}

	ob_start();
	?>
	<div class="bik-ckt-designer-embed" style="width:100%;">
		<iframe
			src="<?php echo esc_url( $src ); ?>"
			title="<?php echo esc_attr__( 'Design Your Own Key Tag', 'bik-custom-key-tag' ); ?>"
			width="100%"
			style="width:100%;min-height:<?php echo esc_attr( (string) $height ); ?>px;border:0;display:block;"
			loading="lazy"
			referrerpolicy="no-referrer-when-downgrade"
			allow="clipboard-write"
		></iframe>
	</div>
	<?php
	return (string) ob_get_clean();
}
add_shortcode( 'bik_custom_key_tag_designer', 'bik_ckt_shortcode_designer' );

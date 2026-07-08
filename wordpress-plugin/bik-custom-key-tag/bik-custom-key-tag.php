<?php
/**
 * Plugin Name: BIK Custom Key Tag
 * Plugin URI:  https://bik-ag.ch
 * Description: WooCommerce integration for the BIK Custom Key Tag designer studio. Adds cart, order email notifications, admin design download, and designer shortcode. Does not modify themes or other plugins.
 * Version:     1.0.0
 * Author:      BIK AG
 * Author URI:  https://bik-ag.ch
 * Text Domain: bik-custom-key-tag
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * WC requires at least: 5.0
 * WC tested up to: 9.0
 *
 * @package BIK_Custom_Key_Tag
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'BIK_CKT_VERSION', '1.0.0' );
define( 'BIK_CKT_PLUGIN_FILE', __FILE__ );
define( 'BIK_CKT_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'BIK_CKT_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

/**
 * Default option values.
 *
 * @return array<string, mixed>
 */
function bik_ckt_default_options() {
	return array(
		'notification_emails' => 'info@bik-ag.ch, sergio.habegger@gmail.com, bestellungen@bik-ag.ch',
		'email_trigger'       => 'processing',
		'studio_base_url'     => 'https://key-tag-studio-1.onrender.com',
		'shared_secret'       => '',
		'product_id'          => '',
		'service_years'       => '4',
	);
}

/**
 * Get a plugin option with default fallback.
 *
 * @param string $key Option key.
 * @return mixed
 */
function bik_ckt_get_option( $key ) {
	$defaults = bik_ckt_default_options();
	$options  = get_option( 'bik_ckt_settings', array() );
	if ( ! is_array( $options ) ) {
		$options = array();
	}
	if ( array_key_exists( $key, $options ) && '' !== $options[ $key ] ) {
		return $options[ $key ];
	}
	return isset( $defaults[ $key ] ) ? $defaults[ $key ] : '';
}

/**
 * All settings as an associative array (merged with defaults).
 *
 * @return array<string, mixed>
 */
function bik_ckt_get_settings() {
	$defaults = bik_ckt_default_options();
	$options  = get_option( 'bik_ckt_settings', array() );
	if ( ! is_array( $options ) ) {
		$options = array();
	}
	return array_merge( $defaults, $options );
}

/**
 * Activation: seed defaults and generate shared secret if missing.
 */
function bik_ckt_activate() {
	$options = get_option( 'bik_ckt_settings', array() );
	if ( ! is_array( $options ) ) {
		$options = array();
	}
	$defaults = bik_ckt_default_options();
	foreach ( $defaults as $key => $value ) {
		if ( ! isset( $options[ $key ] ) || '' === $options[ $key ] ) {
			$options[ $key ] = $value;
		}
	}
	if ( empty( $options['shared_secret'] ) ) {
		$options['shared_secret'] = wp_generate_password( 48, false, false );
	}
	update_option( 'bik_ckt_settings', $options );
}
register_activation_hook( __FILE__, 'bik_ckt_activate' );

/**
 * Bootstrap includes when plugins are loaded.
 */
function bik_ckt_init() {
	if ( ! class_exists( 'WooCommerce' ) ) {
		add_action(
			'admin_notices',
			static function () {
				if ( ! current_user_can( 'activate_plugins' ) ) {
					return;
				}
				echo '<div class="notice notice-error"><p>';
				echo esc_html__( 'BIK Custom Key Tag requires WooCommerce to be active.', 'bik-custom-key-tag' );
				echo '</p></div>';
			}
		);
		return;
	}

	require_once BIK_CKT_PLUGIN_DIR . 'includes/settings.php';
	require_once BIK_CKT_PLUGIN_DIR . 'includes/cart.php';
	require_once BIK_CKT_PLUGIN_DIR . 'includes/email.php';
	require_once BIK_CKT_PLUGIN_DIR . 'includes/admin-order.php';
	require_once BIK_CKT_PLUGIN_DIR . 'includes/shortcode.php';
}
add_action( 'plugins_loaded', 'bik_ckt_init' );

/**
 * Declare WooCommerce feature compatibility (HPOS).
 */
add_action(
	'before_woocommerce_init',
	static function () {
		if ( class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', BIK_CKT_PLUGIN_FILE, true );
		}
	}
);

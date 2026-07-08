<?php
/**
 * Admin settings page for BIK Custom Key Tag.
 *
 * @package BIK_Custom_Key_Tag
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register settings.
 */
function bik_ckt_register_settings() {
	register_setting(
		'bik_ckt_settings_group',
		'bik_ckt_settings',
		array(
			'type'              => 'array',
			'sanitize_callback' => 'bik_ckt_sanitize_settings',
			'default'           => bik_ckt_default_options(),
		)
	);
}
add_action( 'admin_init', 'bik_ckt_register_settings' );

/**
 * Sanitize settings array.
 *
 * @param array $input Raw input.
 * @return array
 */
function bik_ckt_sanitize_settings( $input ) {
	$defaults = bik_ckt_default_options();
	$current  = get_option( 'bik_ckt_settings', array() );
	if ( ! is_array( $current ) ) {
		$current = array();
	}
	$output = array_merge( $defaults, $current );

	if ( ! is_array( $input ) ) {
		return $output;
	}

	if ( isset( $input['notification_emails'] ) ) {
		$emails_raw = sanitize_text_field( wp_unslash( $input['notification_emails'] ) );
		$parts      = array_filter( array_map( 'trim', explode( ',', $emails_raw ) ) );
		$valid      = array();
		foreach ( $parts as $email ) {
			$email = sanitize_email( $email );
			if ( is_email( $email ) ) {
				$valid[] = $email;
			}
		}
		$output['notification_emails'] = implode( ', ', $valid );
	}

	if ( isset( $input['email_trigger'] ) ) {
		$trigger = sanitize_key( $input['email_trigger'] );
		$output['email_trigger'] = in_array( $trigger, array( 'processing', 'completed' ), true )
			? $trigger
			: 'processing';
	}

	if ( isset( $input['studio_base_url'] ) ) {
		$url = esc_url_raw( trim( wp_unslash( $input['studio_base_url'] ) ) );
		$output['studio_base_url'] = untrailingslashit( $url );
	}

	if ( isset( $input['shared_secret'] ) ) {
		$secret = sanitize_text_field( wp_unslash( $input['shared_secret'] ) );
		// Keep existing secret if submitted empty (avoid accidental wipe).
		if ( '' !== $secret ) {
			$output['shared_secret'] = $secret;
		}
	}

	if ( isset( $input['product_id'] ) ) {
		$pid = absint( $input['product_id'] );
		$output['product_id'] = $pid > 0 ? (string) $pid : '';
	}

	if ( isset( $input['service_years'] ) ) {
		$output['service_years'] = sanitize_text_field( wp_unslash( $input['service_years'] ) );
	}

	return $output;
}

/**
 * Add menu under WooCommerce.
 */
function bik_ckt_add_admin_menu() {
	add_submenu_page(
		'woocommerce',
		__( 'BIK Custom Key Tag', 'bik-custom-key-tag' ),
		__( 'BIK Custom Key Tag', 'bik-custom-key-tag' ),
		'manage_woocommerce',
		'bik-custom-key-tag',
		'bik_ckt_render_settings_page'
	);
}
add_action( 'admin_menu', 'bik_ckt_add_admin_menu' );

/**
 * Render settings page.
 */
function bik_ckt_render_settings_page() {
	if ( ! current_user_can( 'manage_woocommerce' ) ) {
		return;
	}

	$settings = bik_ckt_get_settings();
	?>
	<div class="wrap">
		<h1><?php echo esc_html__( 'BIK Custom Key Tag', 'bik-custom-key-tag' ); ?></h1>

		<div class="notice notice-info inline" style="padding:12px 16px;margin:16px 0;">
			<p><strong><?php esc_html_e( 'How notifications work', 'bik-custom-key-tag' ); ?></strong></p>
			<p>
				<?php
				esc_html_e(
					'When a customer pays for an order that includes a custom key tag design, an email is sent to the notification addresses below. The email includes the order number, customer details, design ID, links to the WooCommerce order and studio admin, and the design preview when available.',
					'bik-custom-key-tag'
				);
				?>
			</p>
			<p>
				<?php
				esc_html_e(
					'Email trigger: choose “processing” (recommended for most payment gateways that mark paid orders as Processing) or “completed” if your shop only marks paid custom products as Completed.',
					'bik-custom-key-tag'
				);
				?>
			</p>
			<p>
				<?php
				esc_html_e(
					'Set the WooCommerce product ID for your “Design Your Own” product after you create it. Price is edited on the normal WooCommerce product screen (Regular price). Embed the designer with the shortcode [bik_custom_key_tag_designer].',
					'bik-custom-key-tag'
				);
				?>
			</p>
		</div>

		<form method="post" action="options.php">
			<?php
			settings_fields( 'bik_ckt_settings_group' );
			?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row">
						<label for="bik_ckt_notification_emails"><?php esc_html_e( 'Notification emails', 'bik-custom-key-tag' ); ?></label>
					</th>
					<td>
						<input
							type="text"
							class="large-text"
							id="bik_ckt_notification_emails"
							name="bik_ckt_settings[notification_emails]"
							value="<?php echo esc_attr( $settings['notification_emails'] ); ?>"
						/>
						<p class="description"><?php esc_html_e( 'Comma-separated list of addresses that receive paid-order design notifications.', 'bik-custom-key-tag' ); ?></p>
					</td>
				</tr>
				<tr>
					<th scope="row">
						<label for="bik_ckt_email_trigger"><?php esc_html_e( 'Email trigger', 'bik-custom-key-tag' ); ?></label>
					</th>
					<td>
						<select id="bik_ckt_email_trigger" name="bik_ckt_settings[email_trigger]">
							<option value="processing" <?php selected( $settings['email_trigger'], 'processing' ); ?>>
								<?php esc_html_e( 'processing (default)', 'bik-custom-key-tag' ); ?>
							</option>
							<option value="completed" <?php selected( $settings['email_trigger'], 'completed' ); ?>>
								<?php esc_html_e( 'completed', 'bik-custom-key-tag' ); ?>
							</option>
						</select>
						<p class="description"><?php esc_html_e( 'WooCommerce order status that fires the design notification email.', 'bik-custom-key-tag' ); ?></p>
					</td>
				</tr>
				<tr>
					<th scope="row">
						<label for="bik_ckt_studio_base_url"><?php esc_html_e( 'Studio base URL', 'bik-custom-key-tag' ); ?></label>
					</th>
					<td>
						<input
							type="url"
							class="large-text"
							id="bik_ckt_studio_base_url"
							name="bik_ckt_settings[studio_base_url]"
							value="<?php echo esc_attr( $settings['studio_base_url'] ); ?>"
						/>
						<p class="description"><?php esc_html_e( 'Base URL of the Key Tag Studio app (no trailing slash).', 'bik-custom-key-tag' ); ?></p>
					</td>
				</tr>
				<tr>
					<th scope="row">
						<label for="bik_ckt_shared_secret"><?php esc_html_e( 'Shared secret', 'bik-custom-key-tag' ); ?></label>
					</th>
					<td>
						<input
							type="text"
							class="large-text"
							id="bik_ckt_shared_secret"
							name="bik_ckt_settings[shared_secret]"
							value="<?php echo esc_attr( $settings['shared_secret'] ); ?>"
							autocomplete="off"
						/>
						<p class="description"><?php esc_html_e( 'Used for server-to-server API auth with the studio. Keep private — do not put this in frontend JS. Leave unchanged unless rotating the key.', 'bik-custom-key-tag' ); ?></p>
					</td>
				</tr>
				<tr>
					<th scope="row">
						<label for="bik_ckt_product_id"><?php esc_html_e( 'WooCommerce product ID', 'bik-custom-key-tag' ); ?></label>
					</th>
					<td>
						<input
							type="number"
							min="0"
							step="1"
							class="regular-text"
							id="bik_ckt_product_id"
							name="bik_ckt_settings[product_id]"
							value="<?php echo esc_attr( $settings['product_id'] ); ?>"
						/>
						<p class="description"><?php esc_html_e( 'Product ID for “Design Your Own”. Leave empty until the product is created, then paste its ID here.', 'bik-custom-key-tag' ); ?></p>
					</td>
				</tr>
				<tr>
					<th scope="row">
						<label for="bik_ckt_service_years"><?php esc_html_e( 'Service years display', 'bik-custom-key-tag' ); ?></label>
					</th>
					<td>
						<input
							type="text"
							class="small-text"
							id="bik_ckt_service_years"
							name="bik_ckt_settings[service_years]"
							value="<?php echo esc_attr( $settings['service_years'] ); ?>"
						/>
						<p class="description"><?php esc_html_e( 'Documentation only (default 4). Actual customer-facing “service years” text is edited in the WooCommerce product description.', 'bik-custom-key-tag' ); ?></p>
					</td>
				</tr>
			</table>
			<?php submit_button( __( 'Save settings', 'bik-custom-key-tag' ) ); ?>
		</form>
	</div>
	<?php
}
